// File: app.js

const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('token') || null;
let userProfile = null;
let dailyIntake = { calories: 0, protein: 0, carbs: 0, fat: 0 };
let doctorsData = [];
let appointmentsData = [];
let selectedDoctorId = null;
let calorieChart, macroChart;
const bookAppointmentModal = new bootstrap.Modal(document.getElementById('bookAppointmentModal'));
const videoCallModal = new bootstrap.Modal(document.getElementById('videoCallModal'));


// Simulated data for store and recipes - in a real app, these would come from the backend.
const productDatabase = [
    { id: 1, name: "Weekly Fruit Combo", price: 15.99, image: "https://placehold.co/400x300/3b82f6/FFFFFF?text=Fruit+Combo", description: "A fresh mix of seasonal fruits for a healthy week." },
    { id: 2, name: "Protein Shake Kit", price: 29.99, image: "https://placehold.co/400x300/f59e0b/FFFFFF?text=Protein+Kit", description: "Everything you need for a protein-packed morning shake." },
    { id: 3, name: "Organic Skincare Set", price: 49.99, image: "https://placehold.co/400x300/22c55e/FFFFFF?text=Skincare+Set", description: "Natural, organic products to keep your skin glowing." },
    { id: 4, name: "Yoga Mat & Block Combo", price: 35.00, image: "https://placehold.co/400x300/ec4899/FFFFFF?text=Yoga+Kit", description: "Start your fitness journey with this premium combo." },
];

const recipeDatabase = [
    { id: 1, name: "Healthy Sprout Salad", imageUrl: "https://placehold.co/400x300/fecaca/991b1b?text=Salad", description: "A quick and delicious salad packed with protein and fiber.", calories: 250 },
    { id: 2, name: "Protein-Rich Dal Tadka", imageUrl: "https://placehold.co/400x300/fde68a/92400e?text=Dal", description: "A staple Indian dish that is both nutritious and comforting.", calories: 350 },
    { id: 3, name: "Millet Vegetable Upma", imageUrl: "https://placehold.co/400x300/d1d5db/374151?text=Upma", description: "A healthy and easy breakfast option with millets and vegetables.", calories: 300 },
];

// --- Core Functions ---

function initializeCharts() {
    const calorieCtx = document.getElementById('calorie-chart').getContext('2d');
    calorieChart = new Chart(calorieCtx, {
        type: 'doughnut', data: { labels: ['Consumed', 'Remaining'], datasets: [{ data: [0, 2000], backgroundColor: ['#22c55e', '#e5e7eb'], hoverOffset: 4 }] },
        options: { responsive: true, cutout: '80%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} kcal` } } } }
    });
    const macroCtx = document.getElementById('macro-chart').getContext('2d');
    macroChart = new Chart(macroCtx, {
        type: 'bar', data: { labels: ['Protein', 'Carbs', 'Fat'], datasets: [{ label: 'Consumed (g)', data: [0, 0, 0], backgroundColor: ['#dc3545', '#ffc107', '#0d6efd'], borderWidth: 1 }] },
        options: { responsive: true, scales: { x: { beginAtZero: true }, y: { beginAtZero: true, max: 250 } } }
    });
}

function updateDashboard() {
    const remainingCalories = Math.max(0, userProfile.dailyCalorieGoal - dailyIntake.calories);
    document.getElementById('calories-eaten').textContent = dailyIntake.calories;
    document.getElementById('calorie-goal').textContent = userProfile.dailyCalorieGoal;
    document.getElementById('protein-eaten').textContent = dailyIntake.protein;
    document.getElementById('protein-goal').textContent = userProfile.dailyProteinGoal;
    document.getElementById('carbs-eaten').textContent = dailyIntake.carbs;
    document.getElementById('carbs-goal').textContent = userProfile.dailyCarbGoal;
    document.getElementById('fat-eaten').textContent = dailyIntake.fat;
    document.getElementById('fat-goal').textContent = userProfile.dailyFatGoal;
    calorieChart.data.datasets[0].data = [dailyIntake.calories, remainingCalories];
    calorieChart.update();
    macroChart.data.datasets[0].data = [dailyIntake.protein, dailyIntake.carbs, dailyIntake.fat];
    macroChart.options.scales.y.max = Math.max(userProfile.dailyProteinGoal, userProfile.dailyCarbGoal, userProfile.dailyFatGoal) * 1.2;
    macroChart.update();
}

function addMessage(text, sender) {
    const chatContainer = document.getElementById('chat-container');
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender, 'p-3', 'rounded-4', 'mb-2', 'shadow-sm');
    messageElement.textContent = text;
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- API Calls and Data Fetching ---

async function fetchInitialData() {
    if (!token) return;
    try {
        const profileRes = await fetch(`${API_URL}/profile`, { headers: { 'x-auth-token': token } });
        userProfile = await profileRes.json();
        const summaryRes = await fetch(`${API_URL}/foodlog/summary`, { headers: { 'x-auth-token': token } });
        const summaryData = await summaryRes.json();
        dailyIntake.calories = summaryData.totalCalories || 0;
        dailyIntake.protein = summaryData.totalProtein || 0;
        dailyIntake.carbs = summaryData.totalCarbs || 0;
        dailyIntake.fat = summaryData.totalFat || 0;
        updateDashboard();
        addMessage(`Welcome back, ${userProfile.username}! Your daily goals are: ${userProfile.dailyCalorieGoal} kcal, ${userProfile.dailyProteinGoal}g protein, ${userProfile.dailyCarbGoal}g carbs, and ${userProfile.dailyFatGoal}g fat.`, 'bot');
        document.getElementById('nav-login-status').textContent = 'Logout';
        document.getElementById('nav-login-status').classList.remove('btn-light');
        document.getElementById('nav-login-status').classList.add('btn-danger');
    } catch (err) {
        console.error('Failed to fetch initial data:', err);
        addMessage('An error occurred. Please try logging in again.', 'bot');
        token = null;
        localStorage.removeItem('token');
        document.getElementById('nav-login-status').textContent = 'Login';
        document.getElementById('nav-login-status').classList.remove('btn-danger');
        document.getElementById('nav-login-status').classList.add('btn-light');
    }
}

async function fetchDoctors() {
    try {
        const res = await fetch(`${API_URL}/doctors`);
        doctorsData = await res.json();
        renderDoctors();
    } catch (err) { console.error('Failed to fetch doctors:', err); alert('Failed to load doctor data.'); }
}

async function fetchAppointments() {
    if (!token) { document.getElementById('appointments-container').innerHTML = '<p class="text-center text-muted">Please log in to view your appointments.</p>'; return; }
    try {
        const res = await fetch(`${API_URL}/appointments/user`, { headers: { 'x-auth-token': token } });
        appointmentsData = await res.json();
        renderAppointments();
    } catch (err) { console.error('Failed to fetch appointments:', err); alert('Failed to load your appointments.'); }
}

// --- Page Rendering Functions ---

function renderDoctors() {
    const container = document.getElementById('doctors-container');
    container.innerHTML = '';
    doctorsData.forEach(doctor => {
        const doctorCard = `
            <div class="card card-hover shadow-sm rounded-4 p-4 text-center">
                <img class="rounded-circle mx-auto mb-3" src="${doctor.imageUrl}" alt="${doctor.name}" style="width: 100px; height: 100px; object-fit: cover;">
                <h4 class="h5 fw-bold mb-1">${doctor.name}</h4>
                <p class="text-primary fw-semibold mb-2">${doctor.specialization}</p>
                <div class="text-warning mb-2">
                    ${'&#9733;'.repeat(Math.round(doctor.rating))}
                    ${'&#9734;'.repeat(5 - Math.round(doctor.rating))}
                    <span class="text-muted small">(${doctor.reviews.length} reviews)</span>
                </div>
                <p class="card-text text-muted small">${doctor.bio}</p>
                <p class="h6 fw-bold mt-3">Fee: ₹${doctor.fee}</p>
                <button onclick="openBookingModal('${doctor._id}')" class="btn btn-indigo rounded-pill fw-bold mt-3">Book Appointment</button>
            </div>
        `;
        container.innerHTML += doctorCard;
    });
}

function renderAppointments() {
    const container = document.getElementById('appointments-container');
    container.innerHTML = '';
    if (appointmentsData.length === 0) {
            container.innerHTML = '<p id="no-appointments" class="text-center text-muted">You have no upcoming appointments.</p>';
    } else {
            appointmentsData.forEach(appt => {
            const apptCard = `
                <div class="custom-card shadow-sm p-4 d-flex justify-content-between align-items-center">
                    <div>
                        <p class="h6 fw-bold mb-1">Appointment with ${appt.doctorId.name}</p>
                        <p class="small text-muted mb-1">${appt.doctorId.specialization}</p>
                        <p class="small text-muted mb-0">${new Date(appt.date).toLocaleString()}</p>
                    </div>
                    <button onclick="videoCallModal.show()" class="btn btn-primary rounded-pill fw-bold">
                        <i class="fas fa-video me-2"></i> Start Call
                    </button>
                </div>
            `;
            container.innerHTML += apptCard;
            });
    }
}

function renderStore() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    productDatabase.forEach(product => {
        const productCard = `
            <div class="card card-hover shadow-sm rounded-4 p-4 text-center">
                <img class="rounded-circle mx-auto mb-3" src="${product.image}" alt="${product.name}" style="width: 100px; height: 100px; object-fit: cover;">
                <h4 class="h5 fw-bold mb-1">${product.name}</h4>
                <p class="small text-muted mb-2">${product.description}</p>
                <p class="h6 fw-bold mt-3">₹${product.price.toFixed(2)}</p>
                <button class="btn btn-success rounded-pill fw-bold mt-3">Add to Cart</button>
            </div>
        `;
        container.innerHTML += productCard;
    });
}

function renderRecipes() {
    const container = document.getElementById('recipes-container');
    container.innerHTML = '';
    recipeDatabase.forEach(recipe => {
        const recipeCard = `
            <div class="card card-hover shadow-sm rounded-4 text-center">
                <img class="card-img-top rounded-top-4" src="${recipe.imageUrl}" alt="${recipe.name}">
                <div class="card-body">
                    <h4 class="h5 fw-bold">${recipe.name}</h4>
                    <p class="card-text small text-muted mt-2">${recipe.description}</p>
                    <p class="small text-muted mt-2">~${recipe.calories} kcal</p>
                    <button class="btn btn-info text-white rounded-pill fw-bold mt-3">View Recipe</button>
                </div>
            </div>
        `;
        container.innerHTML += recipeCard;
    });
}

// --- Event Handlers & Core Logic ---

function showPage(pageId) {
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(page => {
        page.classList.remove('active');
        page.classList.add('d-none');
    });
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.remove('d-none');
        activePage.classList.add('active');
    }
    const navButtons = document.querySelectorAll('.btn-sm-custom');
    navButtons.forEach(btn => {
        btn.classList.remove('btn-primary', 'active');
        btn.classList.add('btn-light');
    });
    const activeNavBtn = document.getElementById(`nav-${pageId.replace('page-', '')}`);
    if (activeNavBtn) {
        activeNavBtn.classList.remove('btn-light');
        activeNavBtn.classList.add('btn-primary', 'active');
    }
}

function openBookingModal(doctorId) {
    if (!token) {
        alert('Please log in to book an appointment.');
        return;
    }
    const doctor = doctorsData.find(d => d._id === doctorId);
    if (doctor) {
        selectedDoctorId = doctorId;
        const modalInfo = `<div class="d-flex align-items-center mb-3"><img class="rounded-circle me-3" src="${doctor.imageUrl}" alt="${doctor.name}" style="width: 60px; height: 60px; object-fit: cover;"><div><h4 class="h5 fw-bold mb-0">${doctor.name}</h4><p class="small text-muted mb-0">${doctor.specialization}</p></div></div>`;
        document.getElementById('modal-doctor-info').innerHTML = modalInfo;
        document.getElementById('appointment-reason').value = '';
        bookAppointmentModal.show();
    }
}

document.getElementById('book-appointment-btn').addEventListener('click', async () => {
    const reason = document.getElementById('appointment-reason').value.trim();
    if (!reason) { alert('Please provide a reason for the appointment.'); return; }
    const appointmentDate = new Date().toISOString();
    
    try {
        const res = await fetch(`${API_URL}/appointments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ doctorId: selectedDoctorId, date: appointmentDate, reason })
        });
        if (res.ok) { alert('Appointment booked successfully!'); bookAppointmentModal.hide(); fetchAppointments(); }
        else { const data = await res.json(); alert(`Failed to book appointment: ${data.msg}`); }
    } catch (err) { console.error('Booking failed:', err); alert('A server error occurred while booking.'); }
});

document.getElementById('send-btn').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input').value.trim();
    document.getElementById('user-input').value = '';
    if (userInput === '') return;
    addMessage(userInput, 'user');

    if (!token) {
        if (userInput.startsWith('register ')) {
            const parts = userInput.split(' ');
            const username = parts[1];
            const password = parts[2];
            if (username && password) {
                try {
                    const res = await fetch(`${API_URL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                    const data = await res.json();
                    if (res.ok) {
                        localStorage.setItem('token', data.token);
                        token = data.token;
                        addMessage(`Registration successful! You are now logged in as ${data.user.username}.`, 'bot');
                        fetchInitialData();
                    } else { addMessage(`Error: ${data.msg}`, 'bot'); }
                } catch (err) { addMessage('A server error occurred during registration.', 'bot'); }
            } else { addMessage('Please use format: register <username> <password>', 'bot'); }
        } else if (userInput.startsWith('login ')) {
            const parts = userInput.split(' ');
            const username = parts[1];
            const password = parts[2];
            if (username && password) {
                    try {
                    const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                    const data = await res.json();
                    if (res.ok) {
                        localStorage.setItem('token', data.token);
                        token = data.token;
                        addMessage(`Login successful! Welcome back, ${data.user.username}.`, 'bot');
                        fetchInitialData();
                    } else { addMessage(`Error: ${data.msg}`, 'bot'); }
                } catch (err) { addMessage('A server error occurred during login.', 'bot'); }
            } else { addMessage('Please use format: login <username> <password>', 'bot'); }
        } else { addMessage('Please log in or register to use the chatbot.', 'bot'); }
    } else {
        try {
            const res = await fetch(`${API_URL}/foodlog`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ text: userInput }) });
            const data = await res.json();
            if (res.ok) { addMessage(`Logged: ${data.foodItem} - ${data.calories} kcal.`, 'bot'); fetchInitialData(); } else { addMessage(`Error: ${data.msg}`, 'bot'); }
        } catch (err) { addMessage('A server error occurred while logging food.', 'bot'); }
    }
});

// --- Event Listeners ---
document.getElementById('nav-home').addEventListener('click', () => showPage('page-home'));
document.getElementById('nav-dashboard').addEventListener('click', () => showPage('page-dashboard'));
document.getElementById('nav-store').addEventListener('click', () => { showPage('page-store'); renderStore(); });
document.getElementById('nav-recipes').addEventListener('click', () => { showPage('page-recipes'); renderRecipes(); });
document.getElementById('nav-doctors').addEventListener('click', () => { showPage('page-doctors'); fetchDoctors(); });
document.getElementById('nav-appointments').addEventListener('click', () => { showPage('page-appointments'); fetchAppointments(); });
document.getElementById('nav-login-status').addEventListener('click', () => {
    if (token) {
        localStorage.removeItem('token');
        token = null;
        alert('You have been logged out.');
        location.reload();
    } else {
        showPage('page-dashboard');
    }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    if (token) {
        fetchInitialData();
    }
    showPage('page-home');
});
