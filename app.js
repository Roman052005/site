const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

// Налаштування middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Підключення до MongoDB
mongoose.connect('mongodb://localhost/guitar-club', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB підключено'))
    .catch(err => console.error('Помилка підключення до MongoDB:', err));

// Схеми моделей
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

// Моделі
const User = mongoose.model('User', UserSchema);
const News = mongoose.model('News', NewsSchema);
const History = mongoose.model('History', HistorySchema);
const Guitarist = mongoose.model('Guitarist', GuitaristSchema);
const Comment = mongoose.model('Comment', CommentSchema);

// Middleware для перевірки авторизації
const checkAuth = async (req, res, next) => {
    const userId = req.query.userId || req.body.userId;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Необхідна авторизація' });
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ status: 'error', message: 'Користувача не знайдено' });
    req.user = user;
    next();
};

const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ status: 'error', message: 'Доступ заборонено' });
    next();
};

// UC1: Реєстрація нового користувача
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ status: 'error', message: 'Email вже зайнятий' });
        const user = new User({ username, email, password });
        await user.save();
        res.json({ status: 'success', userId: user._id, message: 'Реєстрація успішна' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC2: Авторизація користувача
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ status: 'error', message: 'Невірні дані' });
        user.lastLogin = new Date();
        await user.save();
        res.json({ status: 'success', user: { id: user._id, role: user.role, username: user.username } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC3: Огляд списку користувачів (адмін)
app.get('/api/users', checkAuth, checkAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({ status: 'success', users });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC4: Управління користувачами (адмін: зміна ролі, видалення)
app.put('/api/users/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ status: 'error', message: 'Невірна роль' });
        await User.findByIdAndUpdate(req.params.id, { role });
        res.json({ status: 'success', message: 'Роль оновлено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

app.delete('/api/users/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ status: 'success', message: 'Користувача видалено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC5: Перегляд новин (доступно всім)
app.get('/api/news', async (req, res) => {
    try {
        const news = await News.find().populate('author', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', news });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC6: Додавання новин (адмін)
app.post('/api/news', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const news = new News({ title, content, author: req.user._id });
        await news.save();
        res.json({ status: 'success', newsId: news._id, message: 'Новину додано' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC7: Редагування новин (адмін)
app.put('/api/news/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const news = await News.findByIdAndUpdate(req.params.id, { title, content, updatedAt: new Date() }, { new: true });
        if (!news) return res.status(404).json({ status: 'error', message: 'Новину не знайдено' });
        res.json({ status: 'success', message: 'Новину оновлено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC8: Видалення новин (адмін)
app.delete('/api/news/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const news = await News.findByIdAndDelete(req.params.id);
        if (!news) return res.status(404).json({ status: 'error', message: 'Новину не знайдено' });
        await Comment.deleteMany({ newsId: req.params.id });
        res.json({ status: 'success', message: 'Новину та її коментарі видалено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC9: Перегляд історії гітар (доступно всім)
app.get('/api/history', async (req, res) => {
    try {
        const history = await History.find().populate('author', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', history });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC10: Додавання історії гітар (адмін)
app.post('/api/history', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const history = new History({ title, content, author: req.user._id });
        await history.save();
        res.json({ status: 'success', historyId: history._id, message: 'Історію додано' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC11: Редагування історії гітар (адмін)
app.put('/api/history/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const history = await History.findByIdAndUpdate(req.params.id, { title, content, updatedAt: new Date() }, { new: true });
        if (!history) return res.status(404).json({ status: 'error', message: 'Історію не знайдено' });
        res.json({ status: 'success', message: 'Історію оновлено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC12: Видалення історії гітар (адмін)
app.delete('/api/history/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const history = await History.findByIdAndDelete(req.params.id);
        if (!history) return res.status(404).json({ status: 'error', message: 'Історію не знайдено' });
        res.json({ status: 'success', message: 'Історію видалено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC13: Перегляд інформації про гітаристів (доступно всім)
app.get('/api/guitarists', async (req, res) => {
    try {
        const guitarists = await Guitarist.find().populate('author', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', guitarists });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC14: Додавання інформації про гітаристів (адмін)
app.post('/api/guitarists', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { name, bio } = req.body;
        if (!name || !bio) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const guitarist = new Guitarist({ name, bio, author: req.user._id });
        await guitarist.save();
        res.json({ status: 'success', guitaristId: guitarist._id, message: 'Гітариста додано' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC15: Редагування інформації про гітаристів (адмін)
app.put('/api/guitarists/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const { name, bio } = req.body;
        if (!name || !bio) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const guitarist = await Guitarist.findByIdAndUpdate(req.params.id, { name, bio, updatedAt: new Date() }, { new: true });
        if (!guitarist) return res.status(404).json({ status: 'error', message: 'Гітариста не знайдено' });
        res.json({ status: 'success', message: 'Інформацію оновлено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC16: Видалення інформації про гітаристів (адмін)
app.delete('/api/guitarists/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const guitarist = await Guitarist.findByIdAndDelete(req.params.id);
        if (!guitarist) return res.status(404).json({ status: 'error', message: 'Гітариста не знайдено' });
        res.json({ status: 'success', message: 'Гітариста видалено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC17: Додавання коментарів (авторизовані користувачі)
app.post('/api/comments', checkAuth, async (req, res) => {
    try {
        const { newsId, text } = req.body;
        if (!newsId || !text) return res.status(400).json({ status: 'error', message: 'Заповніть усі поля' });
        const news = await News.findById(newsId);
        if (!news) return res.status(404).json({ status: 'error', message: 'Новину не знайдено' });
        const comment = new Comment({ newsId, userId: req.user._id, text });
        await comment.save();
        res.json({ status: 'success', commentId: comment._id, message: 'Коментар додано' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// Додатковий маршрут: Отримання коментарів до новини
app.get('/api/comments/:newsId', async (req, res) => {
    try {
        const comments = await Comment.find({ newsId: req.params.newsId }).populate('userId', 'username').sort({ createdAt: -1 });
        res.json({ status: 'success', comments });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// UC18: Видалення коментарів (адмін)
app.delete('/api/comments/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        const comment = await Comment.findByIdAndDelete(req.params.id);
        if (!comment) return res.status(404).json({ status: 'error', message: 'Коментар не знайдено' });
        res.json({ status: 'success', message: 'Коментар видалено' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Помилка сервера: ' + error.message });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущено на http://localhost:${port}`);
    console.log('Доступні маршрути:');
    console.log('- /api/register (POST) - Реєстрація');
    console.log('- /api/login (POST) - Авторизація');
    console.log('- /api/users (GET) - Список користувачів');
    console.log('- /api/users/:id (PUT, DELETE) - Управління користувачами');
    console.log('- /api/news (GET, POST, PUT, DELETE) - Управління новинами');
    console.log('- /api/history (GET, POST, PUT, DELETE) - Управління історією');
    console.log('- /api/guitarists (GET, POST, PUT, DELETE) - Управління гітаристами');
    console.log('- /api/comments (POST) - Додавання коментарів');
    console.log('- /api/comments/:newsId (GET) - Отримання коментарів');
    console.log('- /api/comments/:id (DELETE) - Видалення коментарів');
}); 