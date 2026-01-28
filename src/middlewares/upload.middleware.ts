import multer from "multer"
import path from "path"

const storage = multer.diskStorage({
  destination: "tmp/",
  filename: (_, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

export const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (_, file, cb) => {
    if (path.extname(file.originalname) !== ".zip") {
      cb(new Error("Only ZIP files are allowed"))
      return
    }
    cb(null, true)
  },
})
