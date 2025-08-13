import { supabase, signUp, signIn, signOut, getCurrentUser, getRoutes, getStops, getHubs, getFavorites, updateFavorites } from './src/supabase.js'

// Global state
let currentUser = null
let allRoutes = []
let allStops = []
let allHubs = []
let userFavorites = []

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is logged in
    currentUser = await getCurrentUser()
    
    // Handle different pages
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    
    // Redirect logic
    if (currentUser && (currentPage === 'index.html' || currentPage === 'signup.html')) {
        window.location.href = 'dashboard.html'
        return
    }
    
    if (!currentUser && !['index.html', 'signup.html'].includes(currentPage)) {
        window.location.href = 'index.html'
        return
    }
    
    // Initialize page-specific functionality
    await initializePage(currentPage)
})

async function initializePage(page) {
    switch(page) {
        case 'index.html':
            initializeLogin()
            break
        case 'signup.html':
            initializeSignup()
            break
        case 'dashboard.html':
            await initializeDashboard()
            break
        case 'routes.html':
            await initializeRoutes()
            break
        case 'stops.html':
            await initializeStops()
            break
        case 'hubs.html':
            await initializeHubs()
            break
    }
}

// Authentication functions
function initializeLogin() {
    const loginForm = document.getElementById('loginForm')
    if (!loginForm) return
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault()
        
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const submitBtn = loginForm.querySelector('button[type="submit"]')
        
        submitBtn.textContent = 'Signing in...'
        submitBtn.disabled = true
        
        const { data, error } = await signIn(email, password)
        
        if (error) {
            alert('Login failed: ' + error.message)
            submitBtn.textContent = 'Sign In'
            submitBtn.disabled = false
        } else {
            window.location.href = 'dashboard.html'
        }
    })
}

function initializeSignup() {
    const signupForm = document.getElementById('signupForm')
    if (!signupForm) return
    
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault()
        
        const fullName = document.getElementById('fullName').value
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const confirmPassword = document.getElementById('confirmPassword').value
        const submitBtn = signupForm.querySelector('button[type="submit"]')
        
        if (password !== confirmPassword) {
            alert('Passwords do not match!')
            return
        }
        
        submitBtn.textContent = 'Creating account...'
        submitBtn.disabled = true
        
        const { data, error } = await signUp(email, password, fullName)
        
        if (error) {
            console.error('Signup error details:', error)
            
            // Provide more specific error messages
            let errorMessage = error.message
            if (error.message.includes('Database error') || error.message.includes('unexpected_failure')) {
                errorMessage = 'There appears to be a server configuration issue. Please try again in a few minutes or contact support.'
            } else if (error.message.includes('User already registered')) {
                errorMessage = 'An account with this email already exists. Please try logging in instead.'
            } else if (error.message.includes('Invalid email')) {
                errorMessage = 'Please enter a valid email address.'
            } else if (error.message.includes('Password')) {
                errorMessage = 'Password must be at least 6 characters long.'
            }
            
            alert('Signup failed: ' + errorMessage)
            submitBtn.textContent = 'Create Account'
            submitBtn.disabled = false
        } else {
            alert('Account created successfully! You can now log in.')
            window.location.href = 'index.html'
        }
    })
}

// Dashboard functions
async function initializeDashboard() {
    await loadUserFavorites()
    displayFavorites()
    
    // Global search
    const globalSearch = document.getElementById('globalSearch')
    const searchBtn = document.querySelector('.search-bar button')
    
    if (globalSearch && searchBtn) {
        searchBtn.addEventListener('click', performGlobalSearch)
        globalSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performGlobalSearch()
        })
    }
}

async function performGlobalSearch() {
    const searchTerm = document.getElementById('globalSearch').value.toLowerCase().trim()
    if (!searchTerm) return
    
    // Load all data if not already loaded
    if (allRoutes.length === 0) {
        const { data } = await getRoutes()
        allRoutes = data || []
    }
    if (allStops.length === 0) {
        const { data } = await getStops()
        allStops = data || []
    }
    if (allHubs.length === 0) {
        const { data } = await getHubs()
        allHubs = data || []
    }
    
    const results = [
        ...allRoutes.filter(r => r.name.toLowerCase().includes(searchTerm) || 
                                r.start_point.toLowerCase().includes(searchTerm) || 
                                r.end_point.toLowerCase().includes(searchTerm)),
        ...allStops.filter(s => s.name.toLowerCase().includes(searchTerm)),
        ...allHubs.filter(h => h.name.toLowerCase().includes(searchTerm))
    ]
    
    if (results.length > 0) {
        alert(`Found ${results.length} results for "${searchTerm}"`)
    } else {
        alert(`No results found for "${searchTerm}"`)
    }
}

// Routes page functions
async function initializeRoutes() {
    await loadUserFavorites()
    await loadRoutes()
    
    // Search functionality
    const searchInput = document.getElementById('routeSearch')
    const searchBtn = document.querySelector('.search-bar button')
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', searchRoutes)
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchRoutes()
        })
    }
    
    // Filter functionality
    const typeFilter = document.getElementById('routeTypeFilter')
    const areaFilter = document.getElementById('areaFilter')
    
    if (typeFilter) typeFilter.addEventListener('change', filterRoutes)
    if (areaFilter) areaFilter.addEventListener('change', filterRoutes)
}

async function loadRoutes() {
    const routesList = document.getElementById('routesList')
    if (!routesList) return
    
    routesList.innerHTML = '<div class="loading">Loading routes...</div>'
    
    const { data, error } = await getRoutes()
    
    if (error) {
        routesList.innerHTML = '<div class="error">Failed to load routes</div>'
        return
    }
    
    allRoutes = data || []
    displayRoutes(allRoutes)
}

function displayRoutes(routes) {
    const routesList = document.getElementById('routesList')
    if (!routesList) return
    
    if (routes.length === 0) {
        routesList.innerHTML = '<div class="no-results">No routes found</div>'
        return
    }
    
    routesList.innerHTML = routes.map(route => `
        <div class="item-card">
            <div class="card-header">
                <h4>${route.name}</h4>
                <button class="favorite-btn ${isFavorite('route', route.id) ? 'favorited' : ''}" 
                        onclick="toggleFavorite('route', '${route.id}', '${route.name}')">
                    ${isFavorite('route', route.id) ? '★' : '☆'}
                </button>
            </div>
            <div class="card-content">
                <p><strong>From:</strong> ${route.start_point}</p>
                <p><strong>To:</strong> ${route.end_point}</p>
                <p><strong>Type:</strong> ${route.transport_type}</p>
                <p><strong>Cost:</strong> R${route.cost}</p>
                ${route.hubs ? `<p><strong>Hub:</strong> ${route.hubs.name}</p>` : ''}
            </div>
        </div>
    `).join('')
}

function searchRoutes() {
    const searchTerm = document.getElementById('routeSearch').value.toLowerCase().trim()
    const filtered = allRoutes.filter(route => 
        route.name.toLowerCase().includes(searchTerm) ||
        route.start_point.toLowerCase().includes(searchTerm) ||
        route.end_point.toLowerCase().includes(searchTerm) ||
        route.transport_type.toLowerCase().includes(searchTerm)
    )
    displayRoutes(filtered)
}

function filterRoutes() {
    const typeFilter = document.getElementById('routeTypeFilter').value
    const areaFilter = document.getElementById('areaFilter').value.toLowerCase()
    
    let filtered = allRoutes
    
    if (typeFilter) {
        filtered = filtered.filter(route => route.transport_type === typeFilter)
    }
    
    if (areaFilter) {
        filtered = filtered.filter(route => 
            route.start_point.toLowerCase().includes(areaFilter) ||
            route.end_point.toLowerCase().includes(areaFilter)
        )
    }
    
    displayRoutes(filtered)
}

// Stops page functions
async function initializeStops() {
    await loadUserFavorites()
    await loadStops()
    
    // Search functionality
    const searchInput = document.getElementById('stopSearch')
    const searchBtn = document.querySelector('.search-bar button')
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', searchStops)
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchStops()
        })
    }
    
    // Filter functionality
    const typeFilter = document.getElementById('stopTypeFilter')
    if (typeFilter) typeFilter.addEventListener('change', filterStops)
}

async function loadStops() {
    const stopsList = document.getElementById('stopsList')
    if (!stopsList) return
    
    stopsList.innerHTML = '<div class="loading">Loading stops...</div>'
    
    const { data, error } = await getStops()
    
    if (error) {
        stopsList.innerHTML = '<div class="error">Failed to load stops</div>'
        return
    }
    
    allStops = data || []
    displayStops(allStops)
}

function displayStops(stops) {
    const stopsList = document.getElementById('stopsList')
    if (!stopsList) return
    
    if (stops.length === 0) {
        stopsList.innerHTML = '<div class="no-results">No stops found</div>'
        return
    }
    
    stopsList.innerHTML = stops.map(stop => `
        <div class="item-card">
            <div class="card-header">
                <h4>${stop.name}</h4>
                <button class="favorite-btn ${isFavorite('stop', stop.id) ? 'favorited' : ''}" 
                        onclick="toggleFavorite('stop', '${stop.id}', '${stop.name}')">
                    ${isFavorite('stop', stop.id) ? '★' : '☆'}
                </button>
            </div>
            <div class="card-content">
                <p><strong>Order:</strong> Stop ${stop.order_number}</p>
                ${stop.cost ? `<p><strong>Cost:</strong> R${stop.cost}</p>` : ''}
                ${stop.routes ? `<p><strong>Route:</strong> ${stop.routes.name} (${stop.routes.transport_type})</p>` : ''}
            </div>
        </div>
    `).join('')
}

function searchStops() {
    const searchTerm = document.getElementById('stopSearch').value.toLowerCase().trim()
    const filtered = allStops.filter(stop => 
        stop.name.toLowerCase().includes(searchTerm) ||
        (stop.routes && stop.routes.name.toLowerCase().includes(searchTerm))
    )
    displayStops(filtered)
}

function filterStops() {
    const typeFilter = document.getElementById('stopTypeFilter').value
    
    let filtered = allStops
    
    if (typeFilter && typeFilter !== 'all') {
        filtered = filtered.filter(stop => 
            stop.routes && stop.routes.transport_type === typeFilter
        )
    }
    
    displayStops(filtered)
}

// Hubs page functions
async function initializeHubs() {
    await loadUserFavorites()
    await loadHubs()
    
    // Search functionality
    const searchInput = document.getElementById('hubSearch')
    const searchBtn = document.querySelector('.search-bar button')
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', searchHubs)
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchHubs()
        })
    }
}

async function loadHubs() {
    const hubsList = document.getElementById('hubsList')
    if (!hubsList) return
    
    hubsList.innerHTML = '<div class="loading">Loading hubs...</div>'
    
    const { data, error } = await getHubs()
    
    if (error) {
        hubsList.innerHTML = '<div class="error">Failed to load hubs</div>'
        return
    }
    
    allHubs = data || []
    displayHubs(allHubs)
}

function displayHubs(hubs) {
    const hubsList = document.getElementById('hubsList')
    if (!hubsList) return
    
    if (hubs.length === 0) {
        hubsList.innerHTML = '<div class="no-results">No hubs found</div>'
        return
    }
    
    hubsList.innerHTML = hubs.map(hub => `
        <div class="item-card">
            <div class="card-header">
                <h4>${hub.name}</h4>
                <button class="favorite-btn ${isFavorite('hub', hub.id) ? 'favorited' : ''}" 
                        onclick="toggleFavorite('hub', '${hub.id}', '${hub.name}')">
                    ${isFavorite('hub', hub.id) ? '★' : '☆'}
                </button>
            </div>
            <div class="card-content">
                ${hub.address ? `<p><strong>Address:</strong> ${hub.address}</p>` : ''}
                ${hub.transport_type ? `<p><strong>Transport:</strong> ${hub.transport_type}</p>` : ''}
                <p><strong>Location:</strong> ${hub.latitude.toFixed(4)}, ${hub.longitude.toFixed(4)}</p>
            </div>
        </div>
    `).join('')
}

function searchHubs() {
    const searchTerm = document.getElementById('hubSearch').value.toLowerCase().trim()
    const filtered = allHubs.filter(hub => 
        hub.name.toLowerCase().includes(searchTerm) ||
        (hub.address && hub.address.toLowerCase().includes(searchTerm)) ||
        (hub.transport_type && hub.transport_type.toLowerCase().includes(searchTerm))
    )
    displayHubs(filtered)
}

// Favorites functionality
async function loadUserFavorites() {
    if (!currentUser) return
    
    const { data, error } = await getFavorites(currentUser.id)
    if (!error) {
        userFavorites = data || []
    }
}

function isFavorite(type, id) {
    return userFavorites.some(fav => fav.type === type && fav.id === id)
}

async function toggleFavorite(type, id, name) {
    if (!currentUser) return
    
    const existingIndex = userFavorites.findIndex(fav => fav.type === type && fav.id === id)
    
    if (existingIndex === -1) {
        userFavorites.push({ type, id, name })
    } else {
        userFavorites.splice(existingIndex, 1)
    }
    
    // Update in database
    await updateFavorites(currentUser.id, userFavorites)
    
    // Update UI
    updateFavoriteButtons()
    displayFavorites()
}

function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const type = btn.getAttribute('onclick').match(/toggleFavorite\('(\w+)'/)[1]
        const id = btn.getAttribute('onclick').match(/'([^']+)',\s*'[^']*'\)/)[1]
        
        if (isFavorite(type, id)) {
            btn.classList.add('favorited')
            btn.textContent = '★'
        } else {
            btn.classList.remove('favorited')
            btn.textContent = '☆'
        }
    })
}

function displayFavorites() {
    const favoritesList = document.getElementById('favoritesList')
    if (!favoritesList) return
    
    if (userFavorites.length === 0) {
        favoritesList.innerHTML = '<p class="no-favorites">No favorites yet. Add some routes, stops, or hubs!</p>'
        return
    }
    
    favoritesList.innerHTML = userFavorites.map(fav => 
        `<div class="quick-link" onclick="navigateToPage('${fav.type}')">
            <span class="fav-icon">★</span>
            ${fav.name}
            <span class="fav-type">${fav.type}</span>
        </div>`
    ).join('')
}

function navigateToPage(type) {
    switch(type) {
        case 'route':
            window.location.href = 'routes.html'
            break
        case 'stop':
            window.location.href = 'stops.html'
            break
        case 'hub':
            window.location.href = 'hubs.html'
            break
    }
}

// Logout function
async function logout() {
    await signOut()
    window.location.href = 'index.html'
}

// Make functions globally available
window.toggleFavorite = toggleFavorite
window.navigateToPage = navigateToPage
window.logout = logout