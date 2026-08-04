import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./pages/MainPage", () => () => <main>Koperasi Unipdu</main>);
jest.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
}));
jest.mock("./context/EnvironmentContext", () => ({
  EnvironmentProvider: ({ children }) => children,
}));
jest.mock("./context/FirestoreContext", () => ({
  FirestoreProvider: ({ children }) => children,
}));
jest.mock("./context/DatabaseContext", () => ({
  DatabaseProvider: ({ children }) => children,
}));

test("renders the application shell", () => {
  render(<App />);
  expect(screen.getByText("Koperasi Unipdu")).toBeInTheDocument();
});
