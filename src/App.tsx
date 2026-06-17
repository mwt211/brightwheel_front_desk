import { useEffect, useState } from "react";
import { Chat } from "./parent/Chat";
import { Console } from "./operator/Console";

// Minimal pathname router: parent chat at "/", operator console at "/operator".
// Two routes don't justify a router library.
function usePath(): string {
  const [path, setPath] = useState(
    () => window.location.pathname.replace(/\/+$/, "") || "/",
  );
  useEffect(() => {
    const onPop = () =>
      setPath(window.location.pathname.replace(/\/+$/, "") || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  return path === "/operator" ? <Console /> : <Chat />;
}
