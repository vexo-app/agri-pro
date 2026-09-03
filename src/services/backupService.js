// src/services/backupService.js
import {
  collection, doc,
  addDoc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { COLLECTIONS, MAX_BACKUPS_KEPT } from "../config/constants";

const metaRef      = (userId) => doc(db, COLLECTIONS.BACKUPS, userId);
const snapshotsCol = (userId) => collection(db, COLLECTIONS.BACKUPS, userId, "snapshots");
const snapshotRef  = (userId, id) => doc(db, COLLECTIONS.BACKUPS, userId, "snapshots", id);

// Data-bearing subcollections (under users/{uid}/...) included in every
// backup/restore (settings handled separately below).
const BACKUP_COLLECTIONS = [
  ["equipment",           "equipment"],
  ["jobs",                "jobs"],
  ["drivers",             "drivers"],
  ["maintenance",         "maintenance"],
  ["payments",            "payments"],
  ["salaryEntries",       "salaryEntries"],
  ["attendance",          "attendance"],
  ["custodyTransactions", "custodyTransactions"],
];

const countsFor = (data) =>
  BACKUP_COLLECTIONS.reduce((acc, [key]) => {
    acc[key] = Array.isArray(data[key]) ? data[key].length : 0;
    return acc;
  }, {});

// Overwrite a single subcollection under users/{uid}/{subName} with the
// given snapshot items: deletes any live doc not present in the snapshot,
// and upserts every snapshot item back under its original id. Batched in
// chunks of 450 writes.
const restoreCollection = async (subName, userId, items) => {
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
    ops.push({ type: "set", ref, data: rest });
  });

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => {
      if (op.type === "delete") batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
  }
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

  /** Snapshot list (without the heavy `data` payload), newest first. */
  async list(userId) {
    const q = query(snapshotsCol(userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const { data, ...rest } = d.data();
      return { id: d.id, ...rest };
    });
  },

  /** Full data payload for one snapshot. */
  async getSnapshot(userId, snapshotId) {
    const snap = await getDoc(snapshotRef(userId, snapshotId));
    if (!snap.exists()) throw new Error("النسخة الاحتياطية غير موجودة");
    return JSON.parse(snap.data().data);
  },

  /**
   * Save a full snapshot of the user's data, update the meta doc,
   * and prune older snapshots beyond MAX_BACKUPS_KEPT.
   */
  async createBackup(userId, data) {
    const ref = await addDoc(snapshotsCol(userId), {
      data:      JSON.stringify(data),
      counts:    countsFor(data),
      createdAt: serverTimestamp(),
    });

    await setDoc(metaRef(userId), {
      userId,
      lastBackupAt: serverTimestamp(),
      lastBackupId: ref.id,
    }, { merge: true });

    const all = await this.list(userId);
    const stale = all.slice(MAX_BACKUPS_KEPT);
    await Promise.all(stale.map((b) => deleteDoc(snapshotRef(userId, b.id))));

    return ref.id;
  },

  /**
   * Overwrite the user's live data with a snapshot's data.
   * Caller is responsible for taking a fresh "safety" backup first.
   */
  async restoreSnapshot(userId, snapshotData) {
    // Validate every required collection up front, before any write touches
    // Firestore. Without this, a missing/invalid collection (e.g. `null`
    // instead of an array) would fall through to `|| []` below and silently
    // wipe that collection during restore instead of aborting.
    if (!snapshotData || typeof snapshotData !== "object") {
      throw new Error("بيانات الاسترجاع غير صالحة");
    }
    const invalidKey = BACKUP_COLLECTIONS.find(
      ([key]) => !Array.isArray(snapshotData[key])
    );
    if (invalidKey) {
      throw new Error("بيانات الاسترجاع ناقصة أو غير صالحة، تم إلغاء العملية قبل أي تعديل");
    }

    for (const [key, subName] of BACKUP_COLLECTIONS) {
      await restoreCollection(subName, userId, snapshotData[key] || []);
    }
    if (snapshotData.settings) {
      await setDoc(doc(db, "users", userId, "meta", "settings"), snapshotData.settings);
    }
  },
};
