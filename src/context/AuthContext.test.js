import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { AuthProvider, useAuth } from "./AuthContext";
import { MEMBER_PREVIEW_STORAGE_KEY } from "../utils/memberPreview";

jest.mock("../firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn((database, collectionName, id) => ({
    database,
    collectionName,
    id,
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

const snapshot = (id, data) => ({
  id,
  exists: () => true,
  data: () => data,
});

const PreviewProbe = () => {
  const {
    canPreviewMembers,
    isMemberPreviewing,
    previewMember,
    startMemberPreview,
    stopMemberPreview,
  } = useAuth();

  return (
    <div>
      <span>{canPreviewMembers ? "allowed" : "denied"}</span>
      <span>{isMemberPreviewing ? previewMember?.nama : "not-previewing"}</span>
      <button
        type="button"
        onClick={() =>
          startMemberPreview({
            id: "member-doc",
            uid: "member-uid",
            nama: "Siti Aminah",
            role: "Member",
          })
        }
      >
        Start preview
      </button>
      <button type="button" onClick={stopMemberPreview}>
        Stop preview
      </button>
    </div>
  );
};

beforeEach(() => {
  window.sessionStorage.clear();
  jest.clearAllMocks();
});

test("keeps the Wakil Rektor 2 auth session while previewing a member", async () => {
  let authStateCallback;
  onAuthStateChanged.mockImplementation((auth, callback) => {
    authStateCallback = callback;
    return jest.fn();
  });

  getDoc.mockResolvedValueOnce(
    snapshot("wr2-uid", { role: "Wakil Rektor 2" })
  );

  render(
    <AuthProvider>
      <PreviewProbe />
    </AuthProvider>
  );

  await act(async () => {
    await authStateCallback({ uid: "wr2-uid", email: "wr2@example.com" });
  });

  expect(screen.getByText("allowed")).toBeInTheDocument();

  getDoc.mockResolvedValueOnce(
    snapshot("member-doc", {
      uid: "member-uid",
      nama: "Siti Aminah",
      email: "siti@example.com",
      role: "Member",
      membershipStatus: "approved",
    })
  );

  fireEvent.click(screen.getByRole("button", { name: "Start preview" }));

  await waitFor(() => {
    expect(screen.getByText("Siti Aminah")).toBeInTheDocument();
  });

  const storedSession = JSON.parse(
    window.sessionStorage.getItem(MEMBER_PREVIEW_STORAGE_KEY)
  );
  expect(storedSession.actorUid).toBe("wr2-uid");
  expect(storedSession.member.docId).toBe("member-doc");

  fireEvent.click(screen.getByRole("button", { name: "Stop preview" }));
  expect(screen.getByText("not-previewing")).toBeInTheDocument();
  expect(
    window.sessionStorage.getItem(MEMBER_PREVIEW_STORAGE_KEY)
  ).toBeNull();
});
