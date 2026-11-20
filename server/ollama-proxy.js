import express from "express";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { Readable } from "node:stream";

dotenv.config();

const app = express();

const PORT = process.env.OLLAMA_PROXY_PORT || 3001;
const SECRET = process.env.OLLAMA_PROXY_TOKEN;

if (!SECRET) {
  throw new Error("OLLAMA_PROXY_TOKEN belum diatur di .env");
}

// Periksa token sebelum menerima permintaan.
app.use((req, res, next) => {
  const authorization = req.headers.authorization || "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const expected = Buffer.from(SECRET);
  const supplied = Buffer.from(suppliedToken);

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

app.use(express.json({ limit: "6mb" }));

// Hanya izinkan endpoint chat Ollama.
app.post("/api/chat", async (req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    res.status(response.status);
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Ollama proxy error:", error.message);

    if (!res.headersSent) {
      res.status(502).json({
        error: "Tidak dapat terhubung ke Ollama di laptop",
      });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Ollama proxy berjalan di http://127.0.0.1:${PORT}`);
});