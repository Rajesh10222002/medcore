import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: "#1e293b",
          color:       "#f1f5f9",
          fontSize:    "13px",
          borderRadius: "12px",
          padding:     "12px 16px",
        },
        success: {
          iconTheme: { primary: "#22c55e", secondary: "#fff" }
        },
        error: {
          iconTheme: { primary: "#ef4444", secondary: "#fff" }
        }
      }}
    />
  </StrictMode>
);