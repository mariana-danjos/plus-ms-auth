require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:4001"],
  credentials: true,
}));
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const PORT = process.env.PORT || 3001;

const VALID_ROLES = ["admin", "vendedor", "gestor"];

function buildUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roles: [row.role],
  };
}

function issueTokens(user) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, roles: [user.role] },
    JWT_SECRET,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
  return { token, refreshToken };
}

// POST /auth/signup
app.post("/auth/signup", async (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name)
    return res.status(400).json({ error: "email, password e name são obrigatórios" });

  const finalRole = VALID_ROLES.includes(role) ? role : "vendedor";

  try {
    const exists = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rowCount > 0)
      return res.status(409).json({ error: "E-mail já cadastrado." });

    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, password_hash, name, finalRole],
    );
    const user = rows[0];
    const { token, refreshToken } = issueTokens(user);
    res.status(201).json({ token, refreshToken, user: buildUser(user) });
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ error: "Erro ao criar conta." });
  }
});

// POST /auth/login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "email e password são obrigatórios" });

  const { rows } = await pool.query(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Credenciais inválidas" });

  const { token, refreshToken } = issueTokens(user);
  res.json({ token, refreshToken, user: buildUser(user) });
});

// POST /auth/refresh
app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken)
    return res.status(400).json({ error: "refreshToken obrigatório" });

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [payload.sub],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const tokens = issueTokens(user);
    res.json({ ...tokens, user: buildUser(user) });
  } catch {
    res.status(401).json({ error: "Refresh token inválido ou expirado" });
  }
});

// POST /auth/logout
app.post("/auth/logout", (_req, res) => {
  res.status(204).send();
});

// GET /auth/me
app.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Token não fornecido" });

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [payload.sub],
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(buildUser(user));
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
});

app.listen(PORT, () => console.log(`plus-ms-auth rodando na porta ${PORT}`));
