import { paymentService } from "../services/paymentService";
import { savePendingJobPayment, clearPendingJobPayment } from "./pendingJobPayments";

/**
 * Creates a job and, when supplied, its initial payment through the same
 * path everywhere in the app. Keeping this flow in one place prevents the
 * quick-job screen from storing `amountPaid` on the job without creating a
 * matching payment ledger entry.
 */
export const createJobWithInitialPayment = async ({
  formData,
  userId,
  addJob,
  addPayment,
  deletePayment,
}) => {
  const { amountPaid, ...jobData } = formData;
  const { id: jobId, promise: jobWritePromise } = await addJob(jobData);
  const initialPayment = Number(amountPaid) || 0;

  if (initialPayment > 0) {
    const paymentId = paymentService.generateId(userId);
    const paymentData = {
      jobId,
      amount: initialPayment,
      date: jobData.date,
      notes: "دفعة مقدّمة عند تسجيل العملية",
    };

    savePendingJobPayment(userId, { paymentId, ...paymentData });
    await addPayment(paymentData, paymentId);
    clearPendingJobPayment(userId, paymentId);

    jobWritePromise.catch(() => {
      deletePayment(paymentId);
    });
  }

  return { jobId, hasInitialPayment: initialPayment > 0 };
};
