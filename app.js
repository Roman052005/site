const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

// ������������ middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ϳ��������� �� MongoDB
mongoose.connect('mongodb://localhost/guitar-club', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB ���������'))
    .catch(err => console.error('������� ���������� �� MongoDB:', err));

// ����� �������
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, minlength: 3, maxlength: 50 },
    email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
});

const NewsSchema = new mongoose.Schema({
    title: { type: String, required: true, minlength: 3, maxlength: 100 },
    content: { type: String, required: true, minlength: 10 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
});

const HistorySchema = new mongoose.Schema({
    title: { type: String, required: true, minlength: 3, maxlength: 100 },
    content: { type: String, required: true, minlength: 10 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
});

const GuitaristSchema = new mongoose.Schema({
    name: { type: String, required: true, minlength: 2, maxlength: 50 },
    bio: { type: String, required: true, minlength: 10 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
});

const CommentSchema = new mongoose.Schema({
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: 'News', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, minlength: 1, maxlength: 500 },
    createdAt: { type: Date, default: Date.now }
});

// �����
const User = mongoose.model('User', UserSchema);
const News = mongoose.model('News', NewsSchema);
const History = mongoose.model('History', HistorySchema);
const Guitarist = mongoose.model('Guitarist', GuitaristSchema);
const Comment = mongoose.model('Comment', CommentSchema);

// Middleware ��� �������� �����������
const checkAuth = async (req, res, next) => {
    const userId = req.query.userId || req.body.userId;
    if (!userId) return res.status(401).json({ status: 'error', message: '��������� �����������' });
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ status: 'error', message: '����������� �� ��������' });
    req.user = user;
    next();
};

const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ status: 'error', message: '������ ����������' });
    next();
};

// UC1: ��������� ������ �����������
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ status: 'error', message: 'Email ��� ��������' });
        const user = new User({ username, email, password });
        await user.save();
        res.json({ status: 'success', userId: user._id, message: '��������� ������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC2: ����������� �����������
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ status: 'error', message: '����� ���' });
        user.lastLogin = new Date();
        await user.save();
        res.json({ status: 'success', user: { id: user._id, role: user.role, username: user.username } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC3: ����� ������ ������������ (����)
app.get('/api/users', checkAuth, checkAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({ status: 'success', users });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC4: ��������� ������������� (����: ���� ���, ���������)
app.put('/api/users/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ status: 'error', message: '������ ����' });
        await User.findByIdAndUpdate(req.params.id, { role });
        res.json({ status: 'success', message: '���� ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

app.delete('/api/users/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ status: 'success', message: '����������� ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC5: �������� ����� (�������� ���)
app.get('/api/news', async (req, res) => {
    try {
        const news = await News.find().populate('author', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', news });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC6: ��������� ����� (����)
app.post('/api/news', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const news = new News({ title, content, author: req.user._id });
        await news.save();
        res.json({ status: 'success', newsId: news._id, message: '������ ������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC7: ����������� ����� (����)
app.put('/api/news/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const news = await News.findByIdAndUpdate(req.params.id, { title, content, updatedAt: new Date() }, { new: true });
        if (!news) return res.status(404).json({ status: 'error', message: '������ �� ��������' });
        res.json({ status: 'success', message: '������ ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC8: ��������� ����� (����)
app.delete('/api/news/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const news = await News.findByIdAndDelete(req.params.id);
        if (!news) return res.status(404).json({ status: 'error', message: '������ �� ��������' });
        await Comment.deleteMany({ newsId: req.params.id });
        res.json({ status: 'success', message: '������ �� �� �������� ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC9: �������� ����� ���� (�������� ���)
app.get('/api/history', async (req, res) => {
    try {
        const history = await History.find().populate('author', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', history });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC10: ��������� ����� ���� (����)
app.post('/api/history', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const history = new History({ title, content, author: req.user._id });
        await history.save();
        res.json({ status: 'success', historyId: history._id, message: '������ ������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC11: ����������� ����� ���� (����)
app.put('/api/history/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const history = await History.findByIdAndUpdate(req.params.id, { title, content, updatedAt: new Date() }, { new: true });
        if (!history) return res.status(404).json({ status: 'error', message: '������ �� ��������' });
        res.json({ status: 'success', message: '������ ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC12: ��������� ����� ���� (����)
app.delete('/api/history/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const history = await History.findByIdAndDelete(req.params.id);
        if (!history) return res.status(404).json({ status: 'error', message: '������ �� ��������' });
        res.json({ status: 'success', message: '������ ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC13: �������� ���������� ��� �������� (�������� ���)
app.get('/api/guitarists', async (req, res) => {
    try {
        const guitarists = await Guitarist.find().populate('author', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', guitarists });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC14: ��������� ���������� ��� �������� (����)
app.post('/api/guitarists', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { name, bio } = req.body;
        if (!name || !bio) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const guitarist = new Guitarist({ name, bio, author: req.user._id });
        await guitarist.save();
        res.json({ status: 'success', guitaristId: guitarist._id, message: 'ó������� ������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC15: ����������� ���������� ��� �������� (����)
app.put('/api/guitarists/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { name, bio } = req.body;
        if (!name || !bio) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const guitarist = await Guitarist.findByIdAndUpdate(req.params.id, { name, bio, updatedAt: new Date() }, { new: true });
        if (!guitarist) return res.status(404).json({ status: 'error', message: 'ó������� �� ��������' });
        res.json({ status: 'success', message: '���������� ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC16: ��������� ���������� ��� �������� (����)
app.delete('/api/guitarists/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const guitarist = await Guitarist.findByIdAndDelete(req.params.id);
        if (!guitarist) return res.status(404).json({ status: 'error', message: 'ó������� �� ��������' });
        res.json({ status: 'success', message: 'ó������� ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC17: ��������� ��������� (����������� �����������)
app.post('/api/comments', checkAuth, async (req, res) => {
    try {
        const { newsId, text } = req.body;
        if (!newsId || !text) return res.status(400).json({ status: 'error', message: '�������� �� ����' });
        const news = await News.findById(newsId);
        if (!news) return res.status(404).json({ status: 'error', message: '������ �� ��������' });
        const comment = new Comment({ newsId, userId: req.user._id, text });
        await comment.save();
        res.json({ status: 'success', commentId: comment._id, message: '�������� ������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// ���������� �������: ��������� ��������� �� ������
app.get('/api/comments/:newsId', async (req, res) => {
    try {
        const comments = await Comment.find({ newsId: req.params.newsId }).populate('userId', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', comments });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// UC18: ��������� ��������� (����)
app.delete('/api/comments/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const comment = await Comment.findByIdAndDelete(req.params.id);
        if (!comment) return res.status(404).json({ status: 'error', message: '�������� �� ��������' });
        res.json({ status: 'success', message: '�������� ��������' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: '������� �������: ' + error.message });
    }
});

// ������ �������
app.listen(port, () => {
    console.log(`������ �������� �� http://localhost:${port}`);
    console.log('������� ��������:');
    console.log('- /api/register (POST) - ���������');
    console.log('- /api/login (POST) - �����������');
    console.log('- /api/users (GET) - ������ ������������');
    console.log('- /api/users/:id (PUT, DELETE) - ��������� �������������');
    console.log('- /api/news (GET, POST, PUT, DELETE) - ��������� ��������');
    console.log('- /api/history (GET, POST, PUT, DELETE) - ��������� ������');
    console.log('- /api/guitarists (GET, POST, PUT, DELETE) - ��������� ����������');
    console.log('- /api/comments (POST) - ��������� ���������');
    console.log('- /api/comments/:newsId (GET) - ��������� ���������');
    console.log('- /api/comments/:id (DELETE) - ��������� ���������');
}); 