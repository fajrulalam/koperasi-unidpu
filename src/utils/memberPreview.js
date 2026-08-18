export const MEMBER_PREVIEW_ACTOR_ROLE = "Wakil Rektor 2";
export const MEMBER_PREVIEW_TARGET_ROLE = "Member";
export const MEMBER_PREVIEW_STORAGE_KEY = "koperasi_member_preview_session";

export const buildMemberPreview = (member) => {
  if (!member || typeof member !== "object") return null;

  const docId = member.docId || member.id;
  const role = member.role?.toString().trim();
  if (!docId || role !== MEMBER_PREVIEW_TARGET_ROLE) return null;

  return {
    docId,
    uid: member.uid || null,
    nama: member.nama || "Anggota",
    email: member.email || "",
    nomorAnggota: member.nomorAnggota || null,
    membershipStatus: member.membershipStatus || null,
    role: MEMBER_PREVIEW_TARGET_ROLE,
  };
};

export const isMemberPreviewActor = (actorRole) =>
  actorRole?.toString().trim() === MEMBER_PREVIEW_ACTOR_ROLE;

export const canStartMemberPreview = (actorRole, member) =>
  isMemberPreviewActor(actorRole) && buildMemberPreview(member) !== null;

export const parseMemberPreviewSession = (serializedSession) => {
  if (!serializedSession) return null;

  try {
    const session = JSON.parse(serializedSession);
    const member = buildMemberPreview(session?.member);

    if (!session?.actorUid || !member) return null;
    return { actorUid: session.actorUid, member };
  } catch {
    return null;
  }
};
