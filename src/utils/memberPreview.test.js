import {
  MEMBER_PREVIEW_ACTOR_ROLE,
  MEMBER_PREVIEW_STORAGE_KEY,
  buildMemberPreview,
  canStartMemberPreview,
  parseMemberPreviewSession,
} from "./memberPreview";

const member = {
  id: "Siti_Aminah_123",
  uid: "member-uid",
  nama: "Siti Aminah",
  email: "siti@example.com",
  nomorAnggota: "00123",
  membershipStatus: "approved",
  role: "Member",
  nik: "should-not-be-stored",
};

describe("member preview helpers", () => {
  test("only Wakil Rektor 2 can preview a Member document", () => {
    expect(canStartMemberPreview(MEMBER_PREVIEW_ACTOR_ROLE, member)).toBe(true);
    expect(canStartMemberPreview(" Wakil Rektor 2 ", member)).toBe(true);
    expect(canStartMemberPreview("Director", member)).toBe(false);
    expect(
      canStartMemberPreview(MEMBER_PREVIEW_ACTOR_ROLE, {
        ...member,
        role: "Admin",
      })
    ).toBe(false);
  });

  test("stores only the identity and display fields needed for preview", () => {
    expect(buildMemberPreview(member)).toEqual({
      docId: member.id,
      uid: member.uid,
      nama: member.nama,
      email: member.email,
      nomorAnggota: member.nomorAnggota,
      membershipStatus: member.membershipStatus,
      role: "Member",
    });
    expect(buildMemberPreview(member)).not.toHaveProperty("nik");
  });

  test("restores a valid actor-bound session and rejects malformed state", () => {
    const serialized = JSON.stringify({
      actorUid: "wr2-uid",
      member,
    });

    expect(parseMemberPreviewSession(serialized)).toEqual({
      actorUid: "wr2-uid",
      member: buildMemberPreview(member),
    });
    expect(parseMemberPreviewSession("not-json")).toBeNull();
    expect(parseMemberPreviewSession(JSON.stringify({ member }))).toBeNull();
    expect(MEMBER_PREVIEW_STORAGE_KEY).toBeTruthy();
  });
});
