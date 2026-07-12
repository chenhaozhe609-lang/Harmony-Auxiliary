import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { AuthProvider } from "./app/auth/AuthProvider";
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

