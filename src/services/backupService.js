// src/services/backupService.js
import {
  collection, doc,
  addDoc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch, Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { COLLECTIONS, MAX_BACKUPS_KEPT, BACKUP_CHUNK_BYTES } from "../config/constants";

const metaRef      = (userId) => doc(db, COLLECTIONS.BACKUPS, userId);
const snapshotsCol = (userId) => collection(db, COLLECTIONS.BACKUPS, userId, "snapshots");
const snapshotRef  = (userId, id) => doc(db, COLLECTIONS.BACKUPS, userId, "snapshots", id);
const chunksCol    = (userId, id) => collection(db, COLLECTIONS.BACKUPS, userId, "snapshots", id, "chunks");

// Data-bearing subcollections (under users/{uid}/...) included in every
// backup/restore (settings handled separately below).
//
// ⚠️ أي subcollection بيانات جديدة تتضاف للتطبيق لازم تتضاف هنا كمان،
// وإلا الباك أب هيفضل ياخدها (بتتبعت من DataContext/ProfileModal في
// الـ `data` object) بس الاستعادة (restoreSnapshot) هتتجاهلها بالكامل من
// غير أي تحذير — ده اللي كان حاصل فعليًا مع supplierInvoices/
// supplierPayments قبل الإصلاح ده (كانت بتُنسخ في الباك أب لكن الاستعادة
// كانت بتسيبها كما هي من غير ما ترجّعها).
const BACKUP_COLLECTIONS = [
  ["equipment",           "equipment"],
  ["jobs",                "jobs"],
  ["drivers",             "drivers"],
  ["maintenance",         "maintenance"],
  ["equipmentFuelEntries", "equipmentFuelEntries"],
  ["payments",            "payments"],
  ["supplierInvoices",    "supplierInvoices"],
  ["supplierPayments",    "supplierPayments"],
  ["salaryEntries",       "salaryEntries"],
  ["attendance",          "attendance"],
  ["custodyTransactions", "custodyTransactions"],
  ["taxDeductions",       "taxDeductions"],
];

// audit finding D1: `contacts` و `driverCosts` (users/{uid}/contacts,
// users/{uid}/driverCosts) لسه ما اتضافوش لـ BACKUP_COLLECTIONS، لأن
// إضافتهم هناك كانت هتأثر كمان على createBackup/restoreSnapshot (كل
// أماكن بناء payload الباك أب الأربعة: BackupSection/RestoreModal/
// ImportModal/useAutoBackup محتاجة تتعدّل كلها، وكل نسخة احتياطية قديمة
// موجودة فعليًا دلوقتي هتفشل في الاستعادة لأنها ناقصة الحقلين الجدد —
// ده تعديل أكبر وله مخاطرة على النسخ الموجودة، يحتاج قرارك بشكل مستقل).
// هنا بس بنقفل فجوة wipeAllData (حذف الحساب نهائيًا) لأنها الجزء الآمن
// والمحدود من الـfinding: لازم تُمسح فعليًا زي باقي الـsubcollections،
// حتى من غير ما نلمس منطق الباك أب/الاستعادة أصلًا.
const WIPE_ONLY_COLLECTIONS = ["contacts", "driverCosts"];

const countsFor = (data) =>
  BACKUP_COLLECTIONS.reduce((acc, [key]) => {
    acc[key] = Array.isArray(data[key]) ? data[key].length : 0;
    return acc;
  }, {});

// شكل الـ Timestamp بعد ما يعدي على JSON.stringify/JSON.parse (firebase
// JS SDK v10 بيضيف toJSON() للـ Timestamp بيرجع الشكل ده). أي حقل بالشكل
// ده معناه كان Firestore Timestamp فعلي قبل ما يتحول لنص JSON، ولازم
// يرجع Timestamp تاني وقت الاستعادة، مش يفضل Object عادي جوه المستند.
const isSerializedTimestamp = (v) =>
  v && typeof v === "object" &&
  typeof v.seconds === "number" &&
  typeof v.nanoseconds === "number" &&
  Object.keys(v).every((k) => k === "seconds" || k === "nanoseconds" || k === "type");

// بيمشي جوه أي object/array متداخل ويرجّع كل الحقول اللي شكلها
// isSerializedTimestamp لـ Firestore Timestamp حقيقي — بنستخدم القيمة
// الأصلية (seconds/nanoseconds) نفسها مش وقت دلوقتي، عشان الاستعادة ترجّع
// نفس التاريخ اللي كان موجود فعلاً (createdAt القديمة تفضل قديمة).
const reviveTimestamps = (value) => {
  if (Array.isArray(value)) return value.map(reviveTimestamps);
  if (isSerializedTimestamp(value)) return new Timestamp(value.seconds, value.nanoseconds);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveTimestamps(v);
    return out;
  }
  return value;
};

// Overwrite a single subcollection under users/{uid}/{subName} with the
// given snapshot items: deletes any live doc not present in the snapshot,
// and upserts every snapshot item back under its original id. Batched in
// chunks of 450 writes.
const restoreCollection = async (subName, userId, items, { onBatchCommitted } = {}) => {
  const colRef = collection(db, "users", userId, subName);
  const liveSnap = await getDocs(colRef);
  const snapshotIds = new Set(items.map((it) => it.id).filter(Boolean));

  const ops = [];
  liveSnap.docs.forEach((d) => {
    if (!snapshotIds.has(d.id)) ops.push({ type: "delete", ref: d.ref });
  });
  items.forEach((item) => {
    const { id, userId: _drop, ...rest } = item; // userId no longer stored on the doc itself
    const ref = id ? doc(colRef, id) : doc(colRef);
    ops.push({ type: "set", ref, data: reviveTimestamps(rest) });
  });

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    const batchOps = ops.slice(i, i + 450);
    batchOps.forEach((op) => {
      if (op.type === "delete") batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
    // Firestore commits each batch atomically, but a collection may need
    // several batches. Report every successful commit immediately so a
    // failure in the next batch is never mistaken for "nothing changed".
    onBatchCommitted?.({
      operationsApplied: batchOps.length,
      batchNumber: Math.floor(i / 450) + 1,
      batchCount: Math.ceil(ops.length / 450),
    });
  }
};

// بيقسّم نص JSON طويل لقطع أصغر من BACKUP_CHUNK_BYTES بايت، من غير ما
// يقطع أي حرف UTF-8 متعدد البايتات نص نص (زي الحروف العربية) — بنشفّر
// النص كله لـ bytes مرة واحدة وبعدين نفكّه على أجزاء بـ TextDecoder في
// وضع stream عشان يفضل فاكر أي بايتات ناقصة من حرف اتقطع على حدود القطعة.
const splitIntoChunks = (str, maxBytes) => {
  const bytes = new TextEncoder().encode(str);
  if (bytes.length <= maxBytes) return [str];
  const decoder = new TextDecoder();
  const chunks = [];
  for (let i = 0; i < bytes.length; i += maxBytes) {
    chunks.push(decoder.decode(bytes.subarray(i, i + maxBytes), { stream: true }));
  }
  const tail = decoder.decode(); // flush أي بايتات متبقية من آخر حرف
  if (tail) chunks[chunks.length - 1] += tail;
  return chunks;
};

export const backupService = {
  /** Backup metadata: { lastBackupAt, lastBackupId }. */
  async getMeta(userId) {
    const snap = await getDoc(metaRef(userId));
    return snap.exists() ? snap.data() : null;
  },

  /**
   * أدمن بس (isAdmin() في firestore.rules): تاريخ آخر باك أب لكل الشركات
   * دفعة واحدة، لشاشة متابعة الأدمن. بيرجع { [userId]: lastBackupAt } —
   * الدالة بتقرا مستندات الـ meta بس (وثيقة وحدة صغيرة لكل شركة)، مش
   * محتوى النسخ الاحتياطية نفسه (الـ snapshots subcollection).
   */
  async getAllMeta() {
    const snap = await getDocs(collection(db, COLLECTIONS.BACKUPS));
    const map = {};
    snap.docs.forEach((d) => { map[d.id] = d.data(); });
    return map;
  },

  /**
   * audit finding F-019 (Phase 4): metadata النسخ الاحتياطية لمجموعة
   * UIDs بعينها بس — تستخدم مع الصفحة المعروضة حالياً في لوحة الأدمن
   * (userProfileService.getPage)، بدل getAllMeta() اللي بتجيب كل شركة
   * في النظام دفعة واحدة. getAllMeta() فضلت موجودة زي ما هي — لسه
   * مستخدمة لما الأدمن يبحث فعلياً (نتيجة بحث ممكن تلمس أي شركة، مش
   * بس الصفحة المعروضة).
   *
   * قراءات متوازية (Promise.all) لكل uid على حدة، مش استعلام "in" واحد
   * — عشان يفضل صح مهما كان حجم الصفحة، من غير قلق على حدود Firestore
   * لعدد قيم الـ "in" المسموحة.
   */
  async getMetaFor(userIds) {
    const results = await Promise.all(
      userIds.map(async (uid) => {
        const snap = await getDoc(metaRef(uid));
        return [uid, snap.exists() ? snap.data() : null];
      })
    );
    return Object.fromEntries(results.filter(([, v]) => v !== null));
  },

  /** Snapshot list (without the heavy `data` payload), newest first. */
  async list(userId) {
    const q = query(snapshotsCol(userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const { data, ...rest } = d.data();
      return { id: d.id, ...rest };
    });
  },

  /** Full data payload for one snapshot (مقسّم على chunks لو كان كبير). */
  async getSnapshot(userId, snapshotId) {
    const snap = await getDoc(snapshotRef(userId, snapshotId));
    if (!snap.exists()) throw new Error("النسخة الاحتياطية غير موجودة");
    const meta = snap.data();

    if (!meta.chunked) return JSON.parse(meta.data);

    const chunksSnap = await getDocs(
      query(chunksCol(userId, snapshotId), orderBy("index", "asc"))
    );
    const jsonStr = chunksSnap.docs.map((d) => d.data().text).join("");
    return JSON.parse(jsonStr);
  },

  /**
   * Save a full snapshot of the user's data, update the meta doc,
   * and prune older snapshots beyond MAX_BACKUPS_KEPT.
   *
   * لو الـ JSON اللي بيمثّل بيانات الشركة كبير وقريب من حد Firestore
   * لكل مستند (~1 ميجابايت)، بيتقسّم على مستندات "chunks" فرعية متعددة
   * بدل ما نحاول نكتبه كله في مستند واحد وممكن يفضل. ده بيرفع الحد
   * الفعلي لحجم النسخة الاحتياطية بشكل كبير (كل chunk حده الخاص به)
   * من غير ما يغيّر أي حاجة في شكل البيانات اللي بترجع من getSnapshot.
   */
  async createBackup(userId, data) {
    const jsonStr = JSON.stringify(data);
    const chunks = splitIntoChunks(jsonStr, BACKUP_CHUNK_BYTES);
    const chunked = chunks.length > 1;

    const ref = await addDoc(snapshotsCol(userId), {
      ...(chunked ? { chunked: true, chunkCount: chunks.length } : { data: jsonStr }),
      counts:    countsFor(data),
      createdAt: serverTimestamp(),
    });

    if (chunked) {
      for (let i = 0; i < chunks.length; i += 450) {
        const batch = writeBatch(db);
        chunks.slice(i, i + 450).forEach((text, offset) => {
          const index = i + offset;
          batch.set(doc(chunksCol(userId, ref.id), String(index)), { index, text });
        });
        await batch.commit();
      }
    }

    await setDoc(metaRef(userId), {
      userId,
      lastBackupAt: serverTimestamp(),
      lastBackupId: ref.id,
    }, { merge: true });

    const all = await this.list(userId);
    const stale = all.slice(MAX_BACKUPS_KEPT);
    await Promise.all(stale.map((b) => this.deleteSnapshot(userId, b)));

    return ref.id;
  },

  /** بيمسح مستند النسخة نفسه، وكل الـ chunks التابعة له لو كانت موجودة. */
  async deleteSnapshot(userId, snapshotMeta) {
    if (snapshotMeta.chunked) {
      const chunksSnap = await getDocs(chunksCol(userId, snapshotMeta.id));
      for (let i = 0; i < chunksSnap.docs.length; i += 450) {
        const batch = writeBatch(db);
        chunksSnap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(snapshotRef(userId, snapshotMeta.id));
  },

  /**
   * Overwrite the user's live data with a snapshot's data.
   * Caller is responsible for taking a fresh "safety" backup first.
   *
   * ⚠️ (audit finding E3) restoreSnapshot writes each collection in its own
   * sequential step (restoreCollection itself is already atomic per
   * collection via writeBatch — see above — but the *whole* restore across
   * all ~11 collections is not one atomic operation; Firestore has no way to
   * batch a write this large atomically). If the network drops, the tab
   * closes, or a permission error happens partway through, some collections
   * are already fully restored to the old snapshot's data and the rest are
   * still whatever they were before — a genuine mixed state, not "nothing
   * happened" and not "fully restored" either.
   *
   * Before this fix, every failure here surfaced identically to the caller
   * (a plain Error), so the UI could only ever say a single generic "لم
   * تتأثر بالكامل" message — which is actively WRONG the moment even one
   * collection has already been overwritten. Now the thrown error carries
   * enough information (`isPartialFailure`, `completedKeys`, `totalKeys`,
   * `activeKey`, `appliedOperations`)
   * for the UI to tell the two situations apart and say something true in
   * each case, per the "never say restore succeeded when it didn't, and
   * never be vague about partial" requirement.
   *
   * `onProgress` (optional) is called after each collection finishes, with
   * `{ completedKeys, totalKeys, justCompleted }` — lets the UI show live
   * progress instead of one opaque spinner for the whole operation.
   */
  async restoreSnapshot(userId, snapshotData, { onProgress } = {}) {
    // Validate every required collection up front, before any write touches
    // Firestore. Without this, a missing/invalid collection (e.g. `null`
    // instead of an array) would fall through to `|| []` below and silently
    // wipe that collection during restore instead of aborting.
    if (!snapshotData || typeof snapshotData !== "object") {
      throw new Error("بيانات الاسترجاع غير صالحة");
    }
    // Backups created before the fuel log existed legitimately lack this key.
    if (snapshotData.equipmentFuelEntries === undefined) {
      snapshotData = { ...snapshotData, equipmentFuelEntries: [] };
    }
    const invalidKey = BACKUP_COLLECTIONS.find(
      ([key]) => !Array.isArray(snapshotData[key])
    );
    if (invalidKey) {
      throw new Error("بيانات الاسترجاع ناقصة أو غير صالحة، تم إلغاء العملية قبل أي تعديل");
    }

    // +1 for the trailing "settings" step (only really a step when the
    // snapshot actually carries settings — see below).
    const totalKeys = BACKUP_COLLECTIONS.length + (snapshotData.settings ? 1 : 0);
    const completedKeys = [];
    let activeKey = null;
    let appliedOperations = 0;

    try {
      for (const [key, subName] of BACKUP_COLLECTIONS) {
        activeKey = key;
        await restoreCollection(subName, userId, snapshotData[key] || [], {
          onBatchCommitted: ({ operationsApplied, batchNumber, batchCount }) => {
            appliedOperations += operationsApplied;
            onProgress?.({
              completedKeys: [...completedKeys],
              totalKeys,
              activeKey: key,
              appliedOperations,
              batchNumber,
              batchCount,
            });
          },
        });
        completedKeys.push(key);
        onProgress?.({ completedKeys: [...completedKeys], totalKeys, justCompleted: key });
      }
      if (snapshotData.settings) {
        activeKey = "settings";
        await setDoc(doc(db, "users", userId, "meta", "settings"), reviveTimestamps(snapshotData.settings));
        appliedOperations += 1;
        completedKeys.push("settings");
        onProgress?.({ completedKeys: [...completedKeys], totalKeys, justCompleted: "settings" });
      }
    } catch (err) {
      const isPartialFailure = appliedOperations > 0;
      const wrapped = new Error(
        isPartialFailure
          ? `توقف الاسترجاع بعد تطبيق ${appliedOperations} عملية كتابة — بياناتك الحالية بقت خليط بين القديم والجديد`
          : "فشل الاسترجاع قبل أي تعديل فعلي على بياناتك الحالية"
      );
      wrapped.isPartialFailure = isPartialFailure;
      wrapped.completedKeys = completedKeys;
      wrapped.totalKeys = totalKeys;
      wrapped.activeKey = activeKey;
      wrapped.appliedOperations = appliedOperations;
      wrapped.cause = err;
      throw wrapped;
    }

    return { completedKeys, totalKeys, appliedOperations };
  },

  /**
   * يمسح كل أثر لبيانات المستخدم نهائيًا: كل الـ subcollections المذكورة في
   * BACKUP_COLLECTIONS + مستند الإعدادات (settings) + كل النسخ الاحتياطية
   * (snapshots/chunks) ومستند الـ meta بتاعها + مستند users/{uid} الجذري
   * نفسه (الإيميل/الاسم/تواريخ الإنشاء وآخر نشاط، المستخدم من شاشة الأدمن).
   * بيعيد استخدام نفس restoreCollection اللي بيمسح أي مستند مش موجود في
   * القائمة الجديدة — وهنا القائمة الجديدة فاضية دايمًا، فكل حاجة بتتمسح فعليًا.
   *
   * audit finding F-006: مُستخدمة في مسار حذف الحساب — لازم تتنفذ والمستخدم
   * لسه مسجل دخول (قبل استدعاء deleteUser)، لأن قواعد Firestore كلها
   * مبنية على isOwner(uid) واللي بيحتاج جلسة مصادقة سارية.
   *
   * مستند users/{uid} الجذري كان ممنوع حذفه بالكامل (`allow delete: if
   * false` في firestore.rules) — القاعدة اتغيّرت عمدًا عشان الحذف هنا
   * يبقى كامل فعلًا. مفيش أي أثر لحساب اتحذف بالطريقة دي بيفضل قابل
   * للقراءة من التطبيق بعد كده (لا للمستخدم ولا للأدمن).
   */
  async wipeAllData(userId, { onProgress } = {}) {
    const totalSteps = BACKUP_COLLECTIONS.length + WIPE_ONLY_COLLECTIONS.length + 3; // + settings + backups + account doc

    let done = 0;

    for (const [, subName] of BACKUP_COLLECTIONS) {
      await restoreCollection(subName, userId, []);
      done++;
      onProgress?.({ done, total: totalSteps, step: subName });
    }

    // audit finding D1 — نفس المنطق (restoreCollection بمصفوفة فاضية
    // بتمسح كل مستند موجود فعليًا) لكن على subcollections مش جزء من
    // الباك أب/الاستعادة أصلًا.
    for (const subName of WIPE_ONLY_COLLECTIONS) {
      await restoreCollection(subName, userId, []);
      done++;
      onProgress?.({ done, total: totalSteps, step: subName });
    }

    await deleteDoc(doc(db, "users", userId, "meta", "settings")).catch(() => {});
    done++;
    onProgress?.({ done, total: totalSteps, step: "settings" });

    const snapshots = await this.list(userId).catch(() => []);
    for (const snap of snapshots) {
      await this.deleteSnapshot(userId, snap).catch(() => {});
    }
    await deleteDoc(metaRef(userId)).catch(() => {});
    done++;
    onProgress?.({ done, total: totalSteps, step: "backups" });

    // آخر خطوة عمدًا: مستند users/{uid} الجذري نفسه — بعد ما كل حاجة
    // تحته اتمسحت. لو الحذف اتوقف في نص الطريق (مثلاً أوف لاين)، السجل
    // الجذري بيفضل موجود كدليل إن فيه بيانات لسه محتاجة تكميل الحذف،
    // بدل ما يختفي الدليل قبل ما نتأكد إن الباقي اتمسح فعلاً.
    await deleteDoc(doc(db, "users", userId)).catch(() => {});
    done++;
    onProgress?.({ done, total: totalSteps, step: "account" });
  },
};
