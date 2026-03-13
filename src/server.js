
require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const morgan       = require("morgan");
const connectDB    = require("./config/db");
const initDB       = require("./config/initDB");
const errorHandler = require("./middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 5000;

connectDB().then(() => initDB());


app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));


app.get("/api/health", (_req, res) =>
  res.json({ success: true, message: "EGI API running (MongoDB)", env: process.env.NODE_ENV })
);


app.use("/api/auth",     require("./routes/auth"));
app.use("/api/tasks",    require("./routes/tasks"));
app.use("/api/users",    require("./routes/users"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/reports",  require("./routes/reports"));


app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found." }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n EGI Intern Management API`);
  console.log(`   Port : http://localhost:${PORT}`);
  console.log(`   Env  : ${process.env.NODE_ENV}\n`);
});

module.exports = app;