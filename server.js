// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded files publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ----------------------
// MongoDB Connection
// ----------------------
const mongoURL =
  process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/courseDB';

mongoose
  .connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ----------------------
// Schemas
// ----------------------
const courseSchema = new mongoose.Schema({ name: String });
const Course = mongoose.model('Course', courseSchema);

const fileSchema = new mongoose.Schema({
  title: String,
  url: String, // can be uploaded path or external URL
  course: String,
});
const File = mongoose.model('File', fileSchema);

// ----------------------
// Multer setup
// ----------------------
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const safeName =
      Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, safeName);
  },
});
const upload = multer({ storage });

// ----------------------
// Routes
// ----------------------

// ✅ Get all courses
app.get('/courses', async (req, res) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ✅ Get files for a specific course
app.get('/files/:course', async (req, res) => {
  try {
    const courseName = decodeURIComponent(req.params.course);
    const files = await File.find({ course: courseName });
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ✅ Add new course
app.post('/admin/add-course', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: 'Course name is required' });

    const existing = await Course.findOne({ name });
    if (existing)
      return res.status(400).json({ message: 'Course already exists' });

    await Course.create({ name });
    res.json({ message: 'Course added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding course' });
  }
});

// ✅ Add file via URL
app.post('/admin/add-file', async (req, res) => {
  try {
    const { title, url, course } = req.body;
    if (!title || !url || !course)
      return res.status(400).json({ message: 'Missing fields' });

    let c = await Course.findOne({ name: course });
    if (!c) await Course.create({ name: course });

    await File.create({ title, url, course });
    res.json({ message: 'File added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding file' });
  }
});

// ✅ Upload file from local PC
app.post('/admin/upload-file', upload.single('file'), async (req, res) => {
  try {
    const { title, course } = req.body;
    const file = req.file;
    if (!title || !course || !file)
      return res.status(400).json({ message: 'Missing fields or file' });

    let c = await Course.findOne({ name: course });
    if (!c) await Course.create({ name: course });

    const fileUrl = `uploads/${file.filename}`;

    await File.create({ title, url: fileUrl, course });
    res.json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// ✅ Delete a file
app.delete('/admin/delete-file/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // delete physical file if stored locally
    if (file.url.startsWith('uploads/')) {
      const filePath = path.join(__dirname, file.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await file.deleteOne();
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

// ✅ Delete a course + its files
app.delete('/admin/delete-course/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course)
      return res.status(404).json({ message: 'Course not found' });

    const files = await File.find({ course: course.name });
    for (const file of files) {
      if (file.url.startsWith('uploads/')) {
        const filePath = path.join(__dirname, file.url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      await file.deleteOne();
    }

    await course.deleteOne();
    res.json({ message: 'Course and its files deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting course' });
  }
});

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
