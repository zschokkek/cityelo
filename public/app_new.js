document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const citiesContainer = document.querySelector('.cities-container');
    const loadingElement = document.querySelector('.loading');
    const rankingsTableBody = document.querySelector('#rankings-table tbody');
    const suggestCityForm = document.getElementById('suggest-city-form');
    const cityNameInput = document.getElementById('city-name');
    const suggestionMessage = document.getElementById('suggestion-message');
    
    // Modal elements
    const modalOverlay = document.getElementById('modal-overlay');
    const suggestCityModal = document.getElementById('suggest-city-modal');
    const rankingsModal = document.getElementById('rankings-modal');
    const showRankingsBtn = document.getElementById('show-rankings-btn');
    const showSuggestBtn = document.getElementById('show-suggest-btn');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    
    // City data
    let currentCities = [];
    
    // City card click handler - defined outside to avoid recreation
    function handleCityCardClick(event) {
        const selectedCard = event.currentTarget;
        const otherCardId = selectedCard.id === 'city1' ? 'city2' : 'city1';
        const otherCard = document.getElementById(otherCardId);
        
        const winnerId = selectedCard.dataset.cityId;
        const loserId = otherCard.dataset.cityId;
        
        submitComparison(winnerId, loserId);
    }
    
    // Modal functions
    function openModal(modal) {
        modalOverlay.style.display = 'block';
        modal.style.display = 'block';
        
        if (modal === rankingsModal) {
            fetchRankings(); // Refresh rankings when opening the modal
        }
    }
    
    function closeAllModals() {
        modalOverlay.style.display = 'none';
        suggestCityModal.style.display = 'none';
        rankingsModal.style.display = 'none';
    }
    
    // Fetch random cities for comparison
    function fetchRandomCities() {
        loadingElement.style.display = 'block';
        citiesContainer.style.display = 'none';
        
        fetch('/api/cities/random')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(cities => {
                loadingElement.style.display = 'none';
                citiesContainer.style.display = 'flex';
                displayCities(cities);
                currentCities = cities;
            })
            .catch(error => {
                console.error('Error fetching random cities:', error);
                loadingElement.textContent = 'Error loading cities. Please refresh the page.';
            });
    }
    
    // Display cities for comparison
    function displayCities(cities) {
        if (cities.length !== 2) {
            console.error('Expected 2 cities, got', cities.length);
            return;
        }
        
        // Remove old event listeners
        const city1 = document.getElementById('city1');
        const city2 = document.getElementById('city2');
        
        city1.removeEventListener('click', handleCityCardClick);
        city2.removeEventListener('click', handleCityCardClick);
        
        // Update city data
        city1.dataset.cityId = cities[0].id;
        city2.dataset.cityId = cities[1].id;
        
        document.querySelector('#city1 .city-name').textContent = cities[0].name;
        document.querySelector('#city2 .city-name').textContent = cities[1].name;
        
        // Add new event listeners
        city1.addEventListener('click', handleCityCardClick);
        city2.addEventListener('click', handleCityCardClick);
        
        // Enable the cards for clicking
        city1.style.pointerEvents = 'auto';
        city2.style.pointerEvents = 'auto';
    }
    
    // Submit comparison result
    function submitComparison(winnerId, loserId) {
        // Disable city cards during submission to prevent double-clicks
        document.getElementById('city1').style.pointerEvents = 'none';
        document.getElementById('city2').style.pointerEvents = 'none';
        
        fetch('/api/comparison', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ winnerId, loserId }),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Immediately fetch the next pair
                    fetchRandomCities();
                }
            })
            .catch(error => {
                console.error('Error submitting comparison:', error);
                
                // Re-enable city cards if there was an error
                document.getElementById('city1').style.pointerEvents = 'auto';
                document.getElementById('city2').style.pointerEvents = 'auto';
                
                // Load new cities even if there was an error
                fetchRandomCities();
            });
    }
    
    // Fetch city rankings
    function fetchRankings() {
        fetch('/api/cities/rankings')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(cities => {
                displayRankings(cities);
            })
            .catch(error => {
                console.error('Error fetching rankings:', error);
            });
    }
    
    // Display city rankings
    function displayRankings(cities) {
        rankingsTableBody.innerHTML = '';
        
        cities.forEach((city, index) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${city.name}</td>
                <td>${city.elo}</td>
                <td>${city.wins}/${city.losses}</td>
                <td>${city.comparisons}</td>
            `;
            
            rankingsTableBody.appendChild(row);
        });
    }
    
    // Submit city suggestion
    function suggestCity(cityName) {
        suggestionMessage.textContent = 'Submitting suggestion...';
        suggestionMessage.className = '';
        
        fetch('/api/cities/suggest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cityName }),
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Error submitting city suggestion');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    suggestionMessage.textContent = 'Thank you! Your city suggestion has been received.';
                    suggestionMessage.className = 'success';
                    cityNameInput.value = '';
                }
            })
            .catch(error => {
                console.error('Error submitting city suggestion:', error);
                suggestionMessage.textContent = error.message;
                suggestionMessage.className = 'error';
            });
    }
    
    // Event Listeners
    suggestCityForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const cityName = cityNameInput.value.trim();
        
        if (cityName) {
            suggestCity(cityName);
        }
    });
    
    // Modal event listeners
    showRankingsBtn.addEventListener('click', () => {
        openModal(rankingsModal);
    });
    
    showSuggestBtn.addEventListener('click', () => {
        openModal(suggestCityModal);
    });
    
    // Close modal when clicking the X button
    closeModalButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Close modal when clicking outside the modal content
    modalOverlay.addEventListener('click', (event) => {
        // Only close if clicking directly on the overlay, not on modal content
        if (event.target === modalOverlay) {
            closeAllModals();
        }
    });
    
    // Initialize
    fetchRandomCities();
});
