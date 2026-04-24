import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import https from "https";
import fs from "fs";
import axios from "axios";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

// Initialize Firebase Admin (using internal project ID)
try {
  admin.initializeApp();
} catch (e) {
  // If no default credentials, we'll try to use the project ID from config
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    admin.initializeApp({
      projectId: config.projectId
    });
  }
}

const db = admin.firestore();
const auth = admin.auth();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // User Management Routes
  
  // Create User
  app.post("/api/admin/users/create", async (req, res) => {
    const { email, password, displayName, role, allowedIdentifiers } = req.body;

    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      // Save to Firestore with forcePasswordChange flag
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName: displayName || email.split("@")[0],
        role: role || "viewer",
        allowedIdentifiers: allowedIdentifiers || [],
        forcePasswordChange: true,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Create User Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete User
  app.post("/api/admin/users/delete", async (req, res) => {
    const { uid } = req.body;
    try {
      await auth.deleteUser(uid);
      await db.collection("users").doc(uid).delete();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update Password
  app.post("/api/admin/users/reset-password", async (req, res) => {
    const { uid, newPassword } = req.body;
    try {
      await auth.updateUser(uid, { password: newPassword });
      // Keep force change flag if admin resets it? User specifically asked for it at first login.
      // But if admin manually resets it later, maybe it's fine.
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update User
  app.post("/api/admin/users/update", async (req, res) => {
    const { uid, displayName, email } = req.body;
    try {
      // Update Firebase Auth if email or displayName changed
      const updateParams: any = {};
      if (displayName) updateParams.displayName = displayName;
      if (email) updateParams.email = email;

      if (Object.keys(updateParams).length > 0) {
        await auth.updateUser(uid, updateParams);
      }

      // Update Firestore
      const firestoreUpdate: any = {};
      if (displayName) firestoreUpdate.displayName = displayName;
      if (email) firestoreUpdate.email = email;

      if (Object.keys(firestoreUpdate).length > 0) {
        await db.collection("users").doc(uid).update(firestoreUpdate);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Update User Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Check Sicoob Connection
  app.post("/api/sicoob/check-connection", async (req, res) => {
    const { clientId, clientSecret, certificate, key } = req.body;

    if (!clientId || !certificate || !key) {
      return res.status(400).json({ error: "Credenciais incompletas." });
    }

    try {
      const httpsAgent = new https.Agent({ cert: certificate, key: key, rejectUnauthorized: false });
      
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      params.append("client_id", clientId);
      params.append("scope", "cob.read cob.write pix.read");

      await axios.post(
        "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
        params,
        { httpsAgent, headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 }
      );
      
      res.json({ success: true, status: "Operacional" });
    } catch (error: any) {
      console.error("Check Connection Error:", error.response?.data || error.message);
      res.json({ success: false, status: "Inoperante", details: error.response?.data || error.message });
    }
  });

  // Create Immediate Charge (Cobrança Imediata)
  app.post("/api/sicoob/create-charge", async (req, res) => {
    const { clientId, clientSecret, certificate, key, pixKey, amount, identifier } = req.body;

    if (!clientId || !clientSecret || !certificate || !key || !pixKey) {
      return res.status(400).json({ error: "Configurações do Sicoob ou chave Pix ausentes." });
    }

    try {
      const httpsAgent = new https.Agent({ cert: certificate, key: key, rejectUnauthorized: false });
      
      // 1. Get Token
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      params.append("client_id", clientId);
      params.append("scope", "cob.read cob.write pix.read");

      const authRes = await axios.post(
        "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
        params,
        { httpsAgent, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const token = authRes.data.access_token;

      // 2. Create Charge (txid can be random or provided)
      const txid = identifier || `PX${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      // Sicoob Dynamic Pix (Cobrança Imediata)
      const chargeRes = await axios.put(
        `https://api.sicoob.com.br/pix/v2/cob/${txid}`,
        {
          calendario: { expiracao: 3600 },
          valor: { original: parseFloat(amount).toFixed(2) },
          chave: pixKey,
          solicitacaoPagador: "Pagamento via PixPay CRM"
        },
        {
          httpsAgent,
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      res.json({ 
        success: true, 
        txid: chargeRes.data.txid,
        pixCopiaECola: chargeRes.data.pixCopiaECola,
        status: chargeRes.data.status 
      });
    } catch (error: any) {
      console.error("Create Charge Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Erro ao criar cobrança no Sicoob", details: error.response?.data || error.message });
    }
  });

  // Check Charge Status
  app.get("/api/sicoob/status/:txid", async (req, res) => {
    const { txid } = req.params;
    const { clientId, clientSecret, certificate, key } = req.query;

    if (!clientId || !certificate || !key) {
      return res.status(400).json({ error: "Credenciais ausentes para consulta." });
    }

    try {
      const httpsAgent = new https.Agent({ cert: certificate as string, key: key as string, rejectUnauthorized: false });
      
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      params.append("client_id", clientId as string);
      params.append("scope", "cob.read");

      const authRes = await axios.post(
        "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
        params,
        { httpsAgent, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const token = authRes.data.access_token;

      const statusRes = await axios.get(
        `https://api.sicoob.com.br/pix/v2/cob/${txid}`,
        {
          httpsAgent,
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      res.json({ 
        success: true, 
        status: statusRes.data.status // ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erro ao consultar status no Sicoob" });
    }
  });

  // Sicoob Sync with mTLS
  app.post("/api/sicoob/sync", async (req, res) => {
    const { clientId, clientSecret, certificate, key, pixKey } = req.body;

    if (!clientId || !clientSecret || !certificate || !key) {
      return res.status(400).json({ error: "Configurações do Sicoob incompletas." });
    }

    try {
      // 1. Setup mTLS Agent
      const httpsAgent = new https.Agent({
        cert: certificate,
        key: key,
        rejectUnauthorized: false // Often required for testing with Sicoob's chain in Node environments
      });

      // 2. Get Access Token (OAuth2 Client Credentials with mTLS)
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      params.append("client_id", clientId);
      params.append("scope", "pix.read pix.write");

      const authResponse = await axios.post(
        "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
        params,
        { 
          httpsAgent,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );

      const accessToken = authResponse.data.access_token;

      // 3. Fetch Pix Transactions
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      
      const pixResponse = await axios.get(
        "https://api.sicoob.com.br/pix/v2/pix",
        {
          httpsAgent,
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {
            inicio: fiveDaysAgo.toISOString(),
            fim: now.toISOString()
          }
        }
      );

      // Return transactions to the client
      res.json({ 
        success: true, 
        transactions: pixResponse.data.pix || [] 
      });
    } catch (error: any) {
      console.error("Sicoob Sync Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Falha na sincronização com Sicoob", 
        details: error.response?.data || error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
