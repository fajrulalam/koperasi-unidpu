import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export const normalizeMemberIdentity = (member) => ({
  docId: member?.docId || member?.id || null,
  uid: member?.uid || null,
});

export const resolveMemberDocument = async (database, member) => {
  const { docId, uid } = normalizeMemberIdentity(member);

  if (docId) {
    const memberRef = doc(database, "users", docId);
    const snapshot = await getDoc(memberRef);
    if (snapshot.exists()) {
      return { ref: memberRef, snapshot };
    }
  }

  if (!uid) return null;

  if (uid !== docId) {
    const directRef = doc(database, "users", uid);
    const directSnapshot = await getDoc(directRef);
    if (directSnapshot.exists()) {
      return { ref: directRef, snapshot: directSnapshot };
    }
  }

  const memberQuery = query(
    collection(database, "users"),
    where("uid", "==", uid)
  );
  const querySnapshot = await getDocs(memberQuery);

  if (querySnapshot.empty) return null;

  const snapshot = querySnapshot.docs[0];
  return { ref: doc(database, "users", snapshot.id), snapshot };
};
