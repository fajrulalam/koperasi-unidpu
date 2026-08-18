import { normalizeMemberIdentity } from "./memberIdentity";

describe("normalizeMemberIdentity", () => {
  test("normalizes list rows and resolved member documents", () => {
    expect(normalizeMemberIdentity({ id: "member-doc", uid: "member-uid" })).toEqual({
      docId: "member-doc",
      uid: "member-uid",
    });

    expect(
      normalizeMemberIdentity({ docId: "resolved-doc", uid: "resolved-uid" })
    ).toEqual({
      docId: "resolved-doc",
      uid: "resolved-uid",
    });
  });

  test("returns an empty identity for missing data", () => {
    expect(normalizeMemberIdentity(null)).toEqual({ docId: null, uid: null });
  });
});
