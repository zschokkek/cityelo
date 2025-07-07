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
        
        // Store the current cities data
        currentCities = cities;
        
        // Get references to the city cards
        const city1Card = document.getElementById('city1');
        const city2Card = document.getElementById('city2');
        
        // Reset any previous state
        city1Card.style.pointerEvents = 'auto';
        city2Card.style.pointerEvents = 'auto';
        
        // Update the city IDs and names
        city1Card.dataset.cityId = cities[0].id;
        city2Card.dataset.cityId = cities[1].id;
        
        document.querySelector('#city1 .city-name').textContent = cities[0].name;
        document.querySelector('#city2 .city-name').textContent = cities[1].name;
        
        // Now attach event listeners
        attachCityCardListeners();
    }
    
    // Separate function to attach event listeners to city cards
    function attachCityCardListeners() {
        document.querySelectorAll('.city-card').forEach(card => {
            // First remove existing listeners by cloning
            const newCard = card.cloneNode(true);
            // Preserve the city name, ID, and any styling
            const cityName = card.querySelector('.city-name').textContent;
            const cityId = card.dataset.cityId;
            
            // Copy all attributes and styles
            Array.from(card.attributes).forEach(attr => {
                if (attr.name !== 'id') { // Don't duplicate the ID attribute
                    newCard.setAttribute(attr.name, attr.value);
                }
            });
            
            // Replace the card with the clone
            card.parentNode.replaceChild(newCard, card);
            
            // Make sure the new card has the same data
            newCard.dataset.cityId = cityId;
            newCard.querySelector('.city-name').textContent = cityName;
            
            // Reset pointer-events to ensure clickability
            newCard.style.pointerEvents = 'auto';
            
            // Add new event listener
            newCard.addEventListener('click', function() {
                const selectedCard = this;
                const otherCard = selectedCard.id === 'city1' ? document.getElementById('city2') : document.getElementById('city1');
                
                if (!selectedCard.dataset.cityId || !otherCard.dataset.cityId) {
                    console.error('Missing city ID data', { selectedCard, otherCard });
                    return;
                }
                
                const winnerId = selectedCard.dataset.cityId;
                const loserId = otherCard.dataset.cityId;
                
                submitComparison(winnerId, loserId);
            });
        });
    }
    
    // Submit comparison result
    function submitComparison(winnerId, loserId) {
        // Validate input
        if (!winnerId || !loserId) {
            console.error('Invalid winner or loser ID', { winnerId, loserId });
            return;
        }
        
        // Disable city cards during submission to prevent double-clicks
        document.querySelectorAll('.city-card').forEach(card => {
            card.style.pointerEvents = 'none';
        });
        
        // Show loading state
        loadingElement.style.display = 'block';
        citiesContainer.style.display = 'none';
        
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
                    // Clear current cities before fetching new ones
                    currentCities = [];
                    // Fetch the next pair
                    fetchRandomCities();
                }
            })
            .catch(error => {
                console.error('Error submitting comparison:', error);
                
                // Re-enable city cards if there was an error
                document.querySelectorAll('.city-card').forEach(card => {
                    card.style.pointerEvents = 'auto';
                });
                
                // Show error message
                loadingElement.textContent = 'Error submitting comparison. Fetching new cities...';
                
                // Wait a moment before fetching new cities
                setTimeout(() => {
                    loadingElement.textContent = 'Loading...';
                    fetchRandomCities();
                }, 1500);
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
            
        })
        .catch(error => {
            console.error('Error submitting suggestion:', error);
            displaySuggestionFeedback('An error occurred. Please try again.', 'error');
        });
}

// Helper function to create and display suggestion feedback
function createSuggestionFeedbackElement() {
    const suggestionModal = document.getElementById('suggestion-modal');
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'suggestion-feedback';
    feedbackElement.className = 'suggestion-feedback';
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
    modalOverlay.addEventListener('click', closeAllModals);
    
    // Initialize
    fetchRandomCities();
});
