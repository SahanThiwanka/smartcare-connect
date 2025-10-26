// lib/aiClient.ts
import { httpsCallable, HttpsCallableResult } from "firebase/functions";
import { fns } from "@/lib/firebase";

type CareChatResp = { reply: string };
type SummarizeResp = { summary: string };
type SoapResp = { soap: string };

function unwrap<T>(res: HttpsCallableResult<T>) {
  if (!res || typeof res.data === "undefined") {
    throw new Error("Empty response from AI function.");
  }
  return res.data;
}

export async function aiCareChat(message: string) {
  const fn = httpsCallable<{ message: string }, CareChatResp>(fns, "careChat");
  const res = await fn({ message });
  return unwrap(res).reply;
}

export async function aiSummarizeAppointment(appointmentId: string) {
  const fn = httpsCallable<{ appointmentId: string }, SummarizeResp>(
    fns,
    "summarizeAppointment"
  );
  const res = await fn({ appointmentId });
  return unwrap(res).summary;
}

export async function aiSoapFromNotes(freeText: string) {
  const fn = httpsCallable<{ freeText: string }, SoapResp>(fns, "soapFromNotes");
  const res = await fn({ freeText });
  return unwrap(res).soap;
}
