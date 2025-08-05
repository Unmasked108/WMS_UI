// WMS Frontend JavaScript
class WMSApp {
    constructor() {
        this.baseURL = 'http://localhost:3000'; // Change this to your server URL
        this.currentData = null;
        this.currentTab = 'summary';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkServerHealth();
        this.loadStatusData();
    }

    bindEvents() {
        // Form submission
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processOrders();
        });

        // File input changes
        document.getElementById('masterFile').addEventListener('change', (e) => {
            this.handleFileSelection(e, 'masterFileStatus');
        });

        document.getElementById('orderFiles').addEventListener('change', (e) => {
            this.handleFileSelection(e, 'orderFilesStatus');
        });

        // Action buttons
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetInventory();
        });

        document.getElementById('viewMappingsBtn').addEventListener('click', () => {
            this.viewMappings();
        });

        document.getElementById('viewInventoryBtn').addEventListener('click', () => {
            this.viewInventory();
        });

        document.getElementById('viewChangesBtn').addEventListener('click', () => {
            this.viewChanges();
        });

        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Search and filter events
        document.getElementById('inventorySearch')?.addEventListener('input', (e) => {
            this.filterTable('inventory', e.target.value);
        });

        document.getElementById('inventoryFilter')?.addEventListener('change', (e) => {
            this.filterInventoryByStatus(e.target.value);
        });

        document.getElementById('ordersSearch')?.addEventListener('input', (e) => {
            this.filterTable('orders', e.target.value);
        });

        document.getElementById('marketplaceFilter')?.addEventListener('change', (e) => {
            this.filterOrdersByMarketplace(e.target.value);
        });

        // Modal events
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    async checkServerHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            const data = await response.json();
            
            document.getElementById('serverStatus').textContent = data.status;
            document.getElementById('mappingsCount').textContent = data.mappingsLoaded || 0;
            document.getElementById('combosCount').textContent = data.combosLoaded || 0;
            document.getElementById('inventoryCount').textContent = data.inventoryItems || 0;
            
            this.showToast('Server connection successful', 'success');
        } catch (error) {
            document.getElementById('serverStatus').textContent = 'Offline';
            this.showToast('Failed to connect to server', 'error');
            console.error('Server health check failed:', error);
        }
    }

    async loadStatusData() {
        try {
            // Load mappings count
            const mappingsResponse = await fetch(`${this.baseURL}/mappings`);
            const mappingsData = await mappingsResponse.json();
            document.getElementById('mappingsCount').textContent = mappingsData.totalMappings || 0;

            // Load combos count
            const combosResponse = await fetch(`${this.baseURL}/combos`);
            const combosData = await combosResponse.json();
            document.getElementById('combosCount').textContent = combosData.totalCombos || 0;

            // Load inventory count
            const inventoryResponse = await fetch(`${this.baseURL}/inventory`);
            const inventoryData = await inventoryResponse.json();
            document.getElementById('inventoryCount').textContent = inventoryData.totalItems || 0;

        } catch (error) {
            console.error('Failed to load status data:', error);
        }
    }

    handleFileSelection(event, statusElementId) {
        const files = event.target.files;
        const statusElement = document.getElementById(statusElementId);
        
        if (files.length > 0) {
            const fileNames = Array.from(files).map(file => file.name).join(', ');
            statusElement.textContent = `Selected: ${fileNames}`;
            statusElement.className = 'file-status success';
        } else {
            statusElement.textContent = '';
            statusElement.className = 'file-status';
        }
    }

    async processOrders() {
        const formData = new FormData();
        const masterFile = document.getElementById('masterFile').files[0];
        const orderFiles = document.getElementById('orderFiles').files;

        if (orderFiles.length === 0) {
            this.showToast('Please select at least one order file', 'error');
            return;
        }

        // Add master file if selected
        if (masterFile) {
            formData.append('masterFile', masterFile);
        }

        // Add order files
        for (let i = 0; i < orderFiles.length; i++) {
            formData.append('orderFiles', orderFiles[i]);
        }

        // Show loading spinner
        this.showLoading(true);
        document.getElementById('processBtn').disabled = true;

        try {
            const response = await fetch(`${this.baseURL}/process-orders`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.currentData = result;
                this.displayResults(result);
                this.showToast('Orders processed successfully!', 'success');
                this.loadStatusData(); // Refresh status cards
            } else {
                throw new Error(result.error || 'Processing failed');
            }

        } catch (error) {
            console.error('Processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
            document.getElementById('processBtn').disabled = false;
        }
    }

    displayResults(data) {
        // Show results section
        document.getElementById('resultsSection').classList.add('show');

        // Display summary cards
        this.displaySummaryCards(data.summary);

        // Display detailed results in tabs
        this.displaySummaryTab(data);
        this.displayInventoryTab(data.inventoryUpdates);
        this.displayOrdersTab(data.processedOrders);
        this.displayUnmappedTab(data.unmappedSkus);

        // Populate marketplace filter
        this.populateMarketplaceFilter(data.summary.marketplaceSummary);
    }

    displaySummaryCards(summary) {
        const summaryCards = document.getElementById('summaryCards');
        summaryCards.innerHTML = `
            <div class="summary-card">
                <h3>${summary.totalOrdersProcessed}</h3>
                <p>Orders Processed</p>
            </div>
            <div class="summary-card">
                <h3>${summary.uniqueMskusAffected}</h3>
                <p>Unique MSKUs</p>
            </div>
            <div class="summary-card">
                <h3>${summary.totalQuantitySold}</h3>
                <p>Total Quantity Sold</p>
            </div>
            <div class="summary-card">
                <h3>${summary.outOfStockItems}</h3>
                <p>Out of Stock Items</p>
            </div>
            <div class="summary-card">
                <h3>${summary.unmappedSkusCount}</h3>
                <p>Unmapped SKUs</p>
            </div>
        `;
    }

    displaySummaryTab(data) {
        const summaryContent = document.getElementById('summaryContent');
        let marketplaceSummaryHtml = '';

        if (data.summary.marketplaceSummary) {
            marketplaceSummaryHtml = '<h3>Marketplace Summary</h3><div class="table-container">';
            marketplaceSummaryHtml += '<table class="data-table"><thead><tr>';
            marketplaceSummaryHtml += '<th>Marketplace</th><th>Orders</th><th>Unique MSKUs</th><th>Total Quantity</th><th>Unmapped SKUs</th>';
            marketplaceSummaryHtml += '</tr></thead><tbody>';

            Object.entries(data.summary.marketplaceSummary).forEach(([marketplace, stats]) => {
                marketplaceSummaryHtml += `
                    <tr>
                        <td><strong>${marketplace.toUpperCase()}</strong></td>
                        <td class="number">${stats.ordersProcessed}</td>
                        <td class="number">${stats.uniqueMskus}</td>
                        <td class="number">${stats.totalQuantity}</td>
                        <td class="number">${stats.unmappedSkus}</td>
                    </tr>
                `;
            });

            marketplaceSummaryHtml += '</tbody></table></div>';
        }

        summaryContent.innerHTML = `
            <div class="summary-details">
                <h3>Processing Summary</h3>
                <p><strong>Total Orders Processed:</strong> ${data.summary.totalOrdersProcessed}</p>
                <p><strong>Unique MSKUs Affected:</strong> ${data.summary.uniqueMskusAffected}</p>
                <p><strong>Total Quantity Sold:</strong> ${data.summary.totalQuantitySold}</p>
                <p><strong>Out of Stock Items:</strong> ${data.summary.outOfStockItems}</p>
                <p><strong>Unmapped SKUs:</strong> ${data.summary.unmappedSkusCount}</p>
                <br>
                ${marketplaceSummaryHtml}
            </div>
        `;
    }

    displayInventoryTab(inventoryUpdates) {
        const inventoryContent = document.getElementById('inventoryContent');
        
        if (!inventoryUpdates || inventoryUpdates.length === 0) {
            inventoryContent.innerHTML = '<p>No inventory updates found.</p>';
            return;
        }

        let tableHtml = `
            <table class="data-table" id="inventoryTable">
                <thead>
                    <tr>
                        <th>MSKU</th>
                        <th>Panel</th>
                        <th>Original Stock</th>
                        <th>Sold Qty</th>
                        <th>New Stock</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        inventoryUpdates.forEach(item => {
            const statusClass = item.isOutOfStock ? 'outofstock' : 
                               item.newStock < 10 ? 'lowstock' : 'instock';
            const statusText = item.notInInventory ? 'Not Found' : 
                              item.isOutOfStock ? 'Out of Stock' : 'In Stock';

            tableHtml += `
                <tr>
                    <td><strong>${item.msku}</strong></td>
                    <td>${item.panel}</td>
                    <td class="number">${item.originalStock}</td>
                    <td class="number">${item.soldQuantity}</td>
                    <td class="number">${item.newStock}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        inventoryContent.innerHTML = tableHtml;
    }

    displayOrdersTab(processedOrders) {
        const ordersContent = document.getElementById('ordersContent');
        
        if (!processedOrders || processedOrders.length === 0) {
            ordersContent.innerHTML = '<p>No processed orders found.</p>';
            return;
        }

        let tableHtml = `
            <table class="data-table" id="ordersTable">
                <thead>
                    <tr>
                        <th>Marketplace</th>
                        <th>Original SKU</th>
                        <th>Mapped MSKU</th>
                        <th>Quantity</th>
                        <th>Status</th>
                        <th>Order Date</th>
                        <th>Customer Location</th>
                        <th>Product Name</th>
                    </tr>
                </thead>
                <tbody>
        `;

        processedOrders.forEach(order => {
            const statusClass = order.status.toLowerCase().includes('delivered') ? 'delivered' :
                               order.status.toLowerCase().includes('shipped') ? 'shipped' :
                               order.status.toLowerCase().includes('cancelled') ? 'cancelled' : '';

            tableHtml += `
                <tr>
                    <td><strong>${order.marketplace.toUpperCase()}</strong></td>
                    <td>${order.originalSku}</td>
                    <td><strong>${order.mappedMsku}</strong></td>
                    <td class="number">${order.quantity}</td>
                    <td><span class="status ${statusClass}">${order.status}</span></td>
                    <td>${order.orderDate || 'N/A'}</td>
                    <td>${order.customerLocation || 'N/A'}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${order.productName || 'N/A'}">${order.productName || 'N/A'}</td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        ordersContent.innerHTML = tableHtml;
    }

    displayUnmappedTab(unmappedSkus) {
        const unmappedContent = document.getElementById('unmappedContent');
        
        if (!unmappedSkus || unmappedSkus.length === 0) {
            unmappedContent.innerHTML = '<p class="text-success">✅ All SKUs were successfully mapped!</p>';
            return;
        }

        let tableHtml = `
            <div class="mb-20">
                <p class="text-warning">⚠️ The following SKUs could not be mapped to MSKUs:</p>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Unmapped SKU</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        unmappedSkus.forEach((sku, index) => {
            tableHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${sku}</strong></td>
                    <td><button class="btn btn-info" onclick="wmsApp.searchSku('${sku}')">Search</button></td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        unmappedContent.innerHTML = tableHtml;
    }

    populateMarketplaceFilter(marketplaceSummary) {
        const marketplaceFilter = document.getElementById('marketplaceFilter');
        marketplaceFilter.innerHTML = '<option value="all">All Marketplaces</option>';
        
        if (marketplaceSummary) {
            Object.keys(marketplaceSummary).forEach(marketplace => {
                marketplaceFilter.innerHTML += `<option value="${marketplace}">${marketplace.toUpperCase()}</option>`;
            });
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;
    }

    filterTable(tableType, searchTerm) {
        const tableId = tableType === 'inventory' ? 'inventoryTable' : 'ordersTable';
        const table = document.getElementById(tableId);
        
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    filterInventoryByStatus(status) {
        const table = document.getElementById('inventoryTable');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const statusCell = row.querySelector('.status');
            if (!statusCell) return;

            const statusClass = statusCell.className;
            let show = true;

            switch (status) {
                case 'outofstock':
                    show = statusClass.includes('outofstock');
                    break;
                case 'lowstock':
                    show = statusClass.includes('lowstock');
                    break;
                case 'all':
                default:
                    show = true;
                    break;
            }

            row.style.display = show ? '' : 'none';
        });
    }

    filterOrdersByMarketplace(marketplace) {
        const table = document.getElementById('ordersTable');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const marketplaceCell = row.cells[0];
            if (!marketplaceCell) return;

            const cellText = marketplaceCell.textContent.toLowerCase();
            const show = marketplace === 'all' || cellText.includes(marketplace.toLowerCase());

            row.style.display = show ? '' : 'none';
        });
    }

    async resetInventory() {
        if (!confirm('Are you sure you want to reset inventory to original state?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/reset-inventory`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Inventory reset successfully!', 'success');
                this.loadStatusData();
                
                // Hide results if showing
                document.getElementById('resultsSection').classList.remove('show');
                this.currentData = null;
            } else {
                throw new Error(result.error || 'Reset failed');
            }

        } catch (error) {
            console.error('Reset error:', error);
            this.showToast(`Reset failed: ${error.message}`, 'error');
        }
    }

    async viewMappings() {
        try {
            const response = await fetch(`${this.baseURL}/mappings`);
            const data = await response.json();

            let content = `
                <h2>SKU to MSKU Mappings (${data.totalMappings} total)</h2>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>MSKU</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.mappings.forEach(mapping => {
                content += `
                    <tr>
                        <td>${mapping.sku}</td>
                        <td><strong>${mapping.msku}</strong></td>
                    </tr>
                `;
            });

            content += `
                        </tbody>
                    </table>
                </div>
                ${data.mappings.length < data.totalMappings ? 
                    `<p class="mt-20 text-info">Showing first ${data.mappings.length} of ${data.totalMappings} mappings</p>` : 
                    ''}
            `;

            this.showModal(content);

        } catch (error) {
            console.error('Error fetching mappings:', error);
            this.showToast('Failed to load mappings', 'error');
        }
    }

    async viewInventory() {
        try {
            const response = await fetch(`${this.baseURL}/inventory`);
            const data = await response.json();

            let content = `
                <h2>Current Inventory (${data.totalItems} total)</h2>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>MSKU</th>
                                <th>Panel</th>
                                <th>Current Stock</th>
                                <th>Original Stock</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.inventory.forEach(item => {
                content += `
                    <tr>
                        <td><strong>${item.msku}</strong></td>
                        <td>${item.panel}</td>
                        <td class="number">${item.currentStock}</td>
                        <td class="number">${item.originalStock}</td>
                        <td>${item.status}</td>
                    </tr>
                `;
            });

            content += `
                        </tbody>
                    </table>
                </div>
                ${data.inventory.length < data.totalItems ? 
                    `<p class="mt-20 text-info">Showing first ${data.inventory.length} of ${data.totalItems} items</p>` : 
                    ''}
            `;

            this.showModal(content);

        } catch (error) {
            console.error('Error fetching inventory:', error);
            this.showToast('Failed to load inventory', 'error');
        }
    }

    async viewChanges() {
        try {
            const response = await fetch(`${this.baseURL}/inventory-changes`);
            const data = await response.json();

            if (data.totalChanges === 0) {
                this.showModal(`
                    <h2>Inventory Changes</h2>
                    <p class="text-info">No inventory changes found. Process some orders first!</p>
                `);
                return;
            }

            let content = `
                <h2>Inventory Changes (${data.totalChanges} items affected)</h2>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>MSKU</th>
                                <th>Panel</th>
                                <th>Original Stock</th>
                                <th>Current Stock</th>
                                <th>Difference</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.changes.forEach(change => {
                content += `
                    <tr>
                        <td><strong>${change.msku}</strong></td>
                        <td>${change.panel}</td>
                        <td class="number">${change.originalStock}</td>
                        <td class="number">${change.currentStock}</td>
                        <td class="number text-danger">-${change.difference}</td>
                        <td>${change.status}</td>
                    </tr>
                `;
            });

            content += '</tbody></table></div>';
            this.showModal(content);

        } catch (error) {
            console.error('Error fetching changes:', error);
            this.showToast('Failed to load changes', 'error');
        }
    }

    searchSku(sku) {
        this.showModal(`
            <h2>SKU Search</h2>
            <p>Searching for SKU: <strong>${sku}</strong></p>
            <p class="text-warning">This SKU was not found in the master mapping file.</p>
            <p>Possible solutions:</p>
            <ul>
                <li>Check if the SKU exists in your master mapping file</li>
                <li>Verify the SKU spelling/format</li>
                <li>Add this SKU to your master mapping file</li>
                <li>Contact your administrator for mapping updates</li>
            </ul>
        `);
    }

    showModal(content) {
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('modal').classList.add('show');
    }

    closeModal() {
        document.getElementById('modal').classList.remove('show');
    }

    showLoading(show) {
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (show) {
            loadingSpinner.classList.add('show');
        } else {
            loadingSpinner.classList.remove('show');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.wmsApp = new WMSApp();
});