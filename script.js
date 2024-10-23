const pizzaPlaceCoordinates = [55.70026779174805, 12.539155960083008];

// Initialize the map
const map = L.map('map').setView(pizzaPlaceCoordinates, 13);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Define the delivery points
const deliveryPoints = {
    'Pizza Place': { lat: 55.70026779174805, lng: 12.539155960083008 },
    'Address 1': { lat: 55.7073357, lng: 12.532992 },
    'Address 2': { lat: 55.69151, lng: 12.540117 },
    'Address 3': { lat: 55.6648012, lng: 12.4591846 }
};

// Function to calculate distance using Haversine formula
function calculateDistance(coord1, coord2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
    const dLon = (coord2.lng - coord1.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.lat * (Math.PI / 180)) * Math.cos(coord2.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Create the graph dynamically
function createGraph() {
    const graph = {};
    const points = Object.keys(deliveryPoints);

    points.forEach(point1 => {
        graph[point1] = {};
        points.forEach(point2 => {
            if (point1 !== point2) {
                const distance = calculateDistance(deliveryPoints[point1], deliveryPoints[point2]);
                graph[point1][point2] = distance; 
            }
        });
    });

    console.log('Graph:', graph); 
    return graph;
}

// Priority Queue Class
class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(element, priority) {
        this.items.push({ element, priority });
        this.items.sort((a, b) => a.priority - b.priority);
    }

    dequeue() {
        return this.items.shift();
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

// Dijkstra's Algorithm Implementation
function dijkstra(graph, start) {
    const distances = {};
    const previous = {};
    const queue = new PriorityQueue();

    // Initialize distances and queue
    for (const vertex in graph) {
        distances[vertex] = vertex === start ? 0 : Infinity; 
        previous[vertex] = null;
        queue.enqueue(vertex, distances[vertex]);
    }

    console.log('Initial Distances:', distances); 

    while (!queue.isEmpty()) {
        const smallest = queue.dequeue().element;

        for (const neighbor in graph[smallest]) {
            const alt = distances[smallest] + graph[smallest][neighbor];
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                previous[neighbor] = smallest;
                queue.enqueue(neighbor, distances[neighbor]); 
            }
        }
    }

    console.log('Final Distances:', distances); 
    console.log('Previous Nodes:', previous); 

    return { distances, previous };
}

// Add a marker for the pizza place
const pizzaPlaceMarker = L.marker(pizzaPlaceCoordinates).addTo(map)
    .bindPopup('Pizza Place')
    .openPopup();

let currentPolyline = null;

// Event listener for finding the route
document.getElementById('find-route').addEventListener('click', function () {
    const userAddress = document.getElementById('address').value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(userAddress)}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const userLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };

       
                deliveryPoints[userAddress] = userLocation;

                map.eachLayer((layer) => {
                    if (layer instanceof L.Marker && layer !== pizzaPlaceMarker) {
                        map.removeLayer(layer);
                    }
                });

                Object.entries(deliveryPoints).forEach(([name, coords]) => {
                    L.marker([coords.lat, coords.lng]).addTo(map).bindPopup(name).openPopup();
                });

                // Create the graph
                const graph = createGraph();

                // Run Dijkstra's algorithm starting from 'Pizza Place'
                const { distances, previous } = dijkstra(graph, 'Pizza Place');

                // Find the path from 'Pizza Place' to the user's typed address
                const route = [];
                let current = userAddress;

                // Backtrack to find the route from the user's typed address to 'Pizza Place'
                while (current !== null) {
                    route.unshift(current);
                    current = previous[current]; 
                }

                // Ensure route includes all delivery addresses
                const includeAddresses = Object.keys(deliveryPoints).filter(address => address !== userAddress && address !== 'Pizza Place');
                includeAddresses.forEach(address => {
                    // Check if the address is already in the route
                    if (!route.includes(address)) {
                        const addressDistance = distances[address];
                        const yourLocationDistance = distances[userAddress];

                        if (addressDistance < yourLocationDistance) {
                            route.splice(route.indexOf(userAddress), 0, address); 
                        } else {
                            route.push(address); 
                        }
                    }
                });

                if (!route.includes('Pizza Place')) {
                    route.unshift('Pizza Place');
                }
                if (!route.includes(userAddress)) {
                    route.push(userAddress);
                }

                console.log('Route:', route);

                const routeCoords = route.map(point => deliveryPoints[point]);

                if (currentPolyline) {
                    map.removeLayer(currentPolyline);
                }

                // Draw polyline for the route and store it in the currentPolyline variable
                currentPolyline = L.polyline(routeCoords.map(coord => [coord.lat, coord.lng]), {
                    color: 'blue',
                    weight: 5,
                    opacity: 0.7,
                    smoothFactor: 1
                }).addTo(map);

                // Update distance display with distances between each node
                let totalDistance = 0; // Initialize total distance
                const distanceText = `Shortest route: ${route.join(' -> ')}<br>Distances:<br>`;
                const distancesBetweenPoints = [];

                for (let i = 0; i < route.length - 1; i++) {
                    const from = route[i];
                    const to = route[i + 1];
                    const distance = graph[from][to]; // Get distance from the graph
                    distancesBetweenPoints.push(`${from} to ${to}: ${distance.toFixed(2)} km`);
                    totalDistance += distance; // Update total distance
                }

                const distanceDetails = distancesBetweenPoints.join('<br>') + `<br><strong>Total Distance: ${totalDistance.toFixed(2)} km</strong>`;
                document.getElementById('distance-display').innerHTML = `${distanceText}${distanceDetails}`;

                map.setView([userLocation.lat, userLocation.lng], 13);
            } else {
                alert('Location not found. Please try again.');
            }
        })
        .catch(error => console.error('Error:', error));
});
