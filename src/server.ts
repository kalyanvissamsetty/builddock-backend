import express from "express"
import dotenv from "dotenv"
dotenv.config()
import cors from "cors"
import buildRoutes from "./routes/build.routes"
import projectRoutes from "./routes/project.routes"
import versionRoutes from "./routes/version.routes";
import publicRoutes from "./routes/public.routes";
import authRoutes from "./routes/auth.routes";
import session from "express-session";
import adminViewerAccessRoutes from "./routes/admin.viewerAccess.routes";
import viewerRoutes from "./routes/viewer.routes";
import adminUsersRoutes from "./routes/admin.users.routes";
const app = express()

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "builddock.sid",
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    },
  }),
);


app.use("/api/builds", buildRoutes)
app.use("/projects", projectRoutes)
app.use("/versions", versionRoutes);
app.use("/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin/viewer-access", adminViewerAccessRoutes);
app.use("/api/viewer", viewerRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.get("/health", (req, res)=>{
  return res.status(200).json({"message": "Health check"})
})
const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
