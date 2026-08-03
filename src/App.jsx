import React from "react";
import CookieCraze from "./components/CookieCraze.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <CookieCraze />
    </ErrorBoundary>
  );
}
