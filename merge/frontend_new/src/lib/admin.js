import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const ADMIN_BOOTSTRAP_EMAIL = "bhmnader@gmail.com";

export function hasAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
}

export async function loadIsAdminByUid(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return hasAdminRole(snap.data()?.role);
  } catch {
    return false;
  }
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return;

  const basePayload = {
    email: user.email || "",
    name: user.displayName || "",
    updatedAt: serverTimestamp(),
  };

  const isBootstrapAdmin =
    String(user.email || "").toLowerCase() === ADMIN_BOOTSTRAP_EMAIL;

  if (isBootstrapAdmin) {
    await setDoc(
      doc(db, "users", user.uid),
      { ...basePayload, role: "admin" },
      { merge: true }
    );
    return;
  }

  await setDoc(doc(db, "users", user.uid), basePayload, { merge: true });
}