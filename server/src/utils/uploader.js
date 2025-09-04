import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const storage = multer.diskStorage({
destination: (_, __, cb) => cb(null, path.join(__dirname, '../../uploads')),
filename: (_, file, cb) => {
const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
cb(null, unique + (file.originalname?.match(/\.[^.]+$/)?.[0] || ''));
}
});


export const upload = multer({ storage });