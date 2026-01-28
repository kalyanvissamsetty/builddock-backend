import express from "express"
import dotenv from "dotenv"
dotenv.config()
import cors from "cors"
import buildRoutes from "./routes/build.routes"
import projectRoutes from "./routes/project.routes"
import versionRoutes from "./routes/version.routes";
import publicRoutes from "./routes/public.routes";

const app = express()

app.use(cors())
app.use(express.json())

app.use("/api/builds", buildRoutes)
app.use("/projects", projectRoutes)
app.use("/versions", versionRoutes);
app.use("/public", publicRoutes);


const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
