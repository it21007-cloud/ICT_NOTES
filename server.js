// server.js
const express = require('express');  
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // serve uploaded files

// ----------------------
// MongoDB Connection
// ----------------------
const mongoURL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/courseDB';
mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// ----------------------
// Schemas
// ----------------------
const courseSchema = new mongoose.Schema({ name: String });
const Course = mongoose.model('Course', courseSchema);

const fileSchema = new mongoose.Schema({
    title: String,
    url: String,       // YouTube link, direct link, or local path
    course: String
});
const File = mongoose.model('File', fileSchema);

// ----------------------
// Multer setup for local uploads
// ----------------------
const upload = multer({ dest: 'uploads/' });

// ----------------------
// Routes
// ----------------------

// Get all courses
app.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find({});
        res.json(courses);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get all files for a course
app.get('/files/:course', async (req, res) => {
    try {
        const files = await File.find({ course: req.params.course });
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Admin: Add a new course
app.post('/admin/add-course', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Course name is required' });

        const existing = await Course.findOne({ name });
        if (existing) return res.status(400).json({ message: 'Course already exists' });

        await Course.create({ name });
        res.json({ message: 'Course added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding course' });
    }
});

// Admin: Add file via URL
app.post('/admin/add-file', async (req, res) => {
    try {
        const { title, url, course } = req.body;
        if (!title || !url || !course) return res.status(400).json({ message: 'Missing fields' });

        let c = await Course.findOne({ name: course });
        if (!c) c = await Course.create({ name: course });

        await File.create({ title, url, course });
        res.json({ message: 'File added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding file' });
    }
});

// Admin: Upload file from local machine
app.post('/admin/upload-file', upload.single('file'), async (req, res) => {
    try {
        const { title, course } = req.body;
        const file = req.file;

        if (!title || !course || !file) return res.status(400).json({ message: 'Missing fields or file' });

        let c = await Course.findOne({ name: course });
        if (!c) c = await Course.create({ name: course });

        // Save file path as URL
        const fileUrl = `uploads/${file.filename}-${file.originalname}`;
        fs.renameSync(file.path, fileUrl);

        await File.create({ title, url: fileUrl, course });
        res.json({ message: 'File uploaded successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Admin: Delete a file
app.delete('/admin/delete-file/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });

        // Delete local file if it exists
        if (file.url.startsWith('uploads/')) {
            fs.unlink(file.url, err => { if(err) console.error(err); });
        }

        await file.deleteOne();
        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting file' });
    }
});

// Admin: Delete a course along with its files
app.delete('/admin/delete-course/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Delete all files associated with the course
        const files = await File.find({ course: course.name });
        for (const file of files) {
            if(file.url.startsWith('uploads/')) fs.unlinkSync(file.url);
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
// Start server
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
