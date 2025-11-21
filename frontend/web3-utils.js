// Web3 Utility Functions
let provider;
let signer;
let userAddress;
let contractAddress = CONFIG.CONTRACT_ADDRESS;
let contract = null;
const API_URL = "http://localhost:5000/api";
const CONTRACT_ABI = [
    "function registerUser(string _name) public",
    "function createLoan(address _borrower, uint256 _principal, uint256 _interestRate, uint256 _durationDays) public",
    "function recordRepayment(uint256 _loanId, uint256 _amount) public",
    "function recordDefault(uint256 _loanId) public",
    "function requestLoan(uint256 _amount, uint256 _interestRate, uint256 _durationDays, string memory _reason) public",
    "function approveLoan(address _borrower, uint256 _requestIndex) public",
    "function getLoanRequests(address _user) public view returns (tuple(uint256 requestId, address borrower, uint256 amount, uint256 interestRate, uint256 durationDays, string reason, bool isApproved, bool isActive)[])",
    "function getCreditScore(address _user) public view returns (uint256)",
    "function getCreditScoreBreakdown(address _user) public view returns (uint256, uint256, uint256, uint256)",
    "function getFinancialHistory(address _user) public view returns (tuple(string activityType, uint256 amount, string description, uint256 timestamp)[])",
    "function getUserLoans(address _user) public view returns (tuple(uint256 loanId, address borrower, uint256 principal, uint256 interestRate, uint256 issueDate, uint256 dueDate, uint256 repaidAmount, bool isRepaid, bool isDefaulted)[])",
    "function userExists(address _user) public view returns (bool)",
    "function getUserInfo(address _user) public view returns (tuple(string name, uint256 creditScore, uint256 totalLoans, uint256 totalRepayments, uint256 defaults, uint256 lastUpdated, bool isActive))",
    "function getAdmin() public view returns (address)",
    "function getLoanCount() public view returns (uint256)",
    "event LoanRequested(uint256 indexed requestId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 durationDays, string reason)",
    "event LoanApproved(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower)"
];

// Set contract address and initialize
function setContractAddress(newAddress) {
    if (!ethers.isAddress(newAddress)) {
        showStatus("Invalid contract address", "error");
        return false;
    }
    
    contractAddress = newAddress;
    localStorage.setItem('creditScoreContractAddress', newAddress);
    
    if (signer) {
        contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
    }
    
    showStatus("Contract address set successfully!", "success");
    return true;
}

// Get contract address
function getContractAddress() {
    return contractAddress;
}

// Initialize Web3 and check for MetaMask
async function initWeb3() {
    if (window.ethereum) {
        try {
            // Create ethers.js provider
            provider = new ethers.BrowserProvider(window.ethereum);
            
            // Listen for chain changes
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    disconnectWallet();
                } else {
                    userAddress = accounts[0];
                    updateWalletStatus();
                }
            });
            
            return true;
        } catch (error) {
            console.error("Error initializing Web3:", error);
            return false;
        }
    } else {
        console.warn("MetaMask not detected");
        return false;
    }
}

// Connect Wallet
async function connectWallet() {
    try {
        // First, switch to Sepolia network (Chain ID: 0xaa36a7)
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }]
            });
        } catch (switchError) {
            // If the chain doesn't exist, add it
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0xaa36a7',
                        chainName: 'Sepolia',
                        rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eac5c8cb99'],
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        blockExplorerUrls: ['https://sepolia.etherscan.io/']
                    }]
                });
            }
        }
        
        // Now request accounts
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        userAddress = accounts[0];
        signer = await provider.getSigner();
        
        // Initialize contract with the configured address
        if (contractAddress && ethers.isAddress(contractAddress)) {
            contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
        }
        
        updateWalletStatus();
        return true;
    } catch (error) {
        console.error("Error connecting wallet:", error);
        showStatus("Error connecting wallet", "error");
        return false;
    }
}

// Disconnect Wallet
function disconnectWallet() {
    userAddress = null;
    signer = null;
    updateWalletStatus();
    clearAllData();
}

// Check if user is admin
function isAdmin() {
    return userAddress && userAddress.toLowerCase() === CONFIG.ADMIN_ADDRESS.toLowerCase();
}

// Update Wallet Status Display & Role-Based UI
function updateWalletStatus() {
    const statusDiv = document.getElementById('walletStatus');
    const connectBtn = document.getElementById('connectWallet');
    
    if (userAddress) {
        const adminLabel = isAdmin() ? " 👑 (ADMIN)" : "";
        statusDiv.textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}${adminLabel}`;
        connectBtn.textContent = "Disconnect";
        connectBtn.onclick = disconnectWallet;
        updateUIByRole();
        loadUserData();
    } else {
        statusDiv.textContent = 'Not connected';
        connectBtn.textContent = 'Connect MetaMask';
        connectBtn.onclick = connectWallet;
        updateUIByRole();
    }
}

// Update UI visibility based on user role
function updateUIByRole() {
    const adminTabButton = document.querySelector('[data-tab="admin"]');
    
    if (isAdmin()) {
        // Show admin tab button for admins
        if (adminTabButton) adminTabButton.style.display = 'flex';
    } else {
        // Hide admin tab button for regular users
        if (adminTabButton) adminTabButton.style.display = 'none';
    }
}

// Clear all user data from display
function clearAllData() {
    document.getElementById('creditScore').textContent = '-';
    document.getElementById('scoreDescription').textContent = 'Connect wallet to view your credit score';
    document.getElementById('scoreBreakdown').innerHTML = '<p>Connect wallet to view breakdown</p>';
    document.getElementById('userProfile').innerHTML = '<p>Connect wallet to view profile</p>';
    document.getElementById('financialHistory').innerHTML = '<p>Connect wallet to view history</p>';
    document.getElementById('loansList').innerHTML = '<p>Connect wallet to view loans</p>';
}

// Fetch user data from blockchain
async function loadUserData() {
    if (!userAddress || !contract) {
        console.log("Not ready for loadUserData - userAddress:", userAddress, "contract:", !!contract);
        return;
    }
    
    try {
        console.log("Loading user data for:", userAddress);
        
        // Check if user exists on blockchain
        let exists = false;
        try {
            exists = await contract.userExists(userAddress);
            console.log("User exists:", exists);
        } catch (e) {
            console.error("Error checking userExists:", e);
            return;
        }
        
        if (exists) {
            console.log("User is registered, loading data...");
            // Load from blockchain
            try {
                console.log("Calling getCreditScore...");
                const score = await contract.getCreditScore(userAddress);
                console.log("Score result:", score, "type:", typeof score);
                const scoreNum = typeof score === 'bigint' ? Number(score) : parseInt(score.toString());
                console.log("Parsed score:", scoreNum);
                document.getElementById('creditScore').textContent = scoreNum;
                document.getElementById('scoreDescription').textContent = getScoreDescription(scoreNum);
                if (document.getElementById('refreshScore')) {
                    document.getElementById('refreshScore').style.display = 'inline-block';
                }
            } catch (e) {
                console.error("Error loading credit score:", e);
                document.getElementById('creditScore').textContent = '600';
                document.getElementById('scoreDescription').textContent = 'Default Score';
            }
            
            // Load user info first to get status and last updated
            try {
                console.log("Calling getUserInfo...");
                const userInfo = await contract.getUserInfo(userAddress);
                console.log("User info result:", userInfo);
                
                // Update status and last updated
                document.getElementById('scoreStatus').textContent = userInfo.isActive ? 'Active' : 'Inactive';
                const timestamp = userInfo.lastUpdated ? (typeof userInfo.lastUpdated === 'bigint' ? Number(userInfo.lastUpdated) * 1000 : userInfo.lastUpdated * 1000) : Date.now();
                document.getElementById('lastUpdated').textContent = new Date(timestamp).toLocaleDateString();
                
                // Update quick stats
                document.getElementById('totalLoans').textContent = userInfo.totalLoans.toString();
                document.getElementById('onTimeLoans').textContent = (parseInt(userInfo.totalLoans.toString()) - parseInt(userInfo.defaults.toString())).toString();
                document.getElementById('defaultCount').textContent = userInfo.defaults.toString();
                
                displayUserProfile({
                    name: userInfo.name,
                    totalLoans: userInfo.totalLoans.toString(),
                    totalRepayments: userInfo.totalRepayments.toString(),
                    defaults: userInfo.defaults.toString(),
                    isActive: userInfo.isActive,
                    lastUpdated: timestamp
                });
            } catch (e) {
                console.error("Error loading user info:", e);
                document.getElementById('userProfile').innerHTML = '<p>Unable to load profile</p>';
            }
            
            // Load breakdown
            try {
                console.log("Calling getCreditScoreBreakdown...");
                const breakdown = await contract.getCreditScoreBreakdown(userAddress);
                console.log("Breakdown result:", breakdown);
                displayScoreBreakdown({
                    paymentHistoryScore: breakdown[0].toString(),
                    repaymentConsistencyScore: breakdown[1].toString(),
                    loanActivityScore: breakdown[2].toString(),
                    totalScore: breakdown[3].toString()
                });
            } catch (e) {
                console.error("Error loading breakdown:", e);
                document.getElementById('scoreBreakdown').innerHTML = '<p>Unable to load breakdown</p>';
            }
            
            // Load loans
            try {
                console.log("Calling getUserLoans...");
                const loans = await contract.getUserLoans(userAddress);
                console.log("Loans result:", loans);
                displayUserLoans(loans);
            } catch (e) {
                console.error("Error loading loans:", e);
                document.getElementById('loansList').innerHTML = '<p>Unable to load loans</p>';
            }
            
            // Load history
            try {
                console.log("Calling getFinancialHistory...");
                const history = await contract.getFinancialHistory(userAddress);
                console.log("History result:", history);
                displayFinancialHistory(history);
            } catch (e) {
                console.error("Error loading history:", e);
                document.getElementById('financialHistory').innerHTML = '<p>Unable to load history</p>';
            }
            
            // Load admin dashboard if admin
            if (isAdmin()) {
                console.log("User is admin, loading admin dashboard...");
                loadAdminDashboard();
                loadAdminRequests();
            }
        } else {
            console.log("User does not exist on blockchain");
            // User not registered yet
            document.getElementById('creditScore').textContent = '-';
            document.getElementById('scoreDescription').textContent = 'Register first to see your credit score';
            document.getElementById('scoreBreakdown').innerHTML = '<p>Register to view breakdown</p>';
            document.getElementById('userProfile').innerHTML = '<p>Register to view profile</p>';
            document.getElementById('financialHistory').innerHTML = '<p>Register to view history</p>';
            document.getElementById('loansList').innerHTML = '<p>Register to view loans</p>';
        }
        
    } catch (error) {
        console.error("Error loading user data:", error);
        document.getElementById('creditScore').textContent = '-';
        document.getElementById('scoreDescription').textContent = 'Error loading data';
    }
}

// Get credit score description
function getScoreDescription(score) {
    if (score >= 750) return "Excellent Credit Score! ✅";
    if (score >= 700) return "Good Credit Score";
    if (score >= 650) return "Fair Credit Score";
    if (score >= 550) return "Poor Credit Score";
    return "Very Poor Credit Score";
}

// Display Score Breakdown
function displayScoreBreakdown(data) {
    const container = document.getElementById('scoreBreakdown');
    
    if (data.error) {
        container.innerHTML = '<p>Error loading breakdown</p>';
        return;
    }
    
    const html = `
        <div class="breakdown-item">
            <h4>Payment History (35%)</h4>
            <p>${data.paymentHistoryScore}</p>
        </div>
        <div class="breakdown-item">
            <h4>Repayment Consistency (25%)</h4>
            <p>${data.repaymentConsistencyScore}</p>
        </div>
        <div class="breakdown-item">
            <h4>Loan Activity (20%)</h4>
            <p>${data.loanActivityScore}</p>
        </div>
        <div class="breakdown-item">
            <h4>Total Score</h4>
            <p>${data.totalScore}</p>
        </div>
    `;
    
    container.innerHTML = html;
}

// Display User Profile
function displayUserProfile(profile) {
    const container = document.getElementById('userProfile');
    
    if (profile.error) {
        container.innerHTML = '<p>User profile not found. Please register first.</p>';
        return;
    }
    
    const html = `
        <div class="profile-item">
            <label>Name</label>
            <strong>${profile.name || 'Not set'}</strong>
        </div>
        <div class="profile-item">
            <label>Total Loans</label>
            <strong>${profile.totalLoans}</strong>
        </div>
        <div class="profile-item">
            <label>Total Repayments</label>
            <strong>${profile.totalRepayments} Wei</strong>
        </div>
        <div class="profile-item">
            <label>Defaults</label>
            <strong>${profile.defaults}</strong>
        </div>
        <div class="profile-item">
            <label>Last Updated</label>
            <strong>${new Date(profile.lastUpdated).toLocaleDateString()}</strong>
        </div>
        <div class="profile-item">
            <label>Status</label>
            <strong>${profile.isActive ? 'Active' : 'Inactive'}</strong>
        </div>
    `;
    
    container.innerHTML = html;
}

// Display Financial History
function displayFinancialHistory(history) {
    const container = document.getElementById('financialHistory');
    
    if (!history || history.length === 0) {
        container.innerHTML = '<p>No financial history available</p>';
        return;
    }
    
    let html = '';
    history.forEach((activity, index) => {
        const date = new Date(activity.timestamp);
        html += `
            <div class="history-item">
                <h4>${activity.activityType}</h4>
                <span class="activity-type">${activity.activityType}</span>
                <p class="activity-amount">${activity.amount} Wei</p>
                <p><small>${activity.description}</small></p>
                <p><small>📅 ${date.toLocaleString()}</small></p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Display User Loans
function displayUserLoans(loans) {
    const container = document.getElementById('loansList');
    
    if (!loans || loans.length === 0) {
        container.innerHTML = '<p>No loans available</p>';
        return;
    }
    
    let html = '';
    loans.forEach((loan) => {
        const issueDate = typeof loan.issueDate === 'bigint' ? new Date(Number(loan.issueDate) * 1000) : new Date(loan.issueDate * 1000);
        const dueDate = typeof loan.dueDate === 'bigint' ? new Date(Number(loan.dueDate) * 1000) : new Date(loan.dueDate * 1000);
        let statusClass = 'status-pending';
        let statusText = 'Pending';
        
        if (loan.isRepaid) {
            statusClass = 'status-repaid';
            statusText = 'Repaid';
        } else if (loan.isDefaulted) {
            statusClass = 'status-defaulted';
            statusText = 'Defaulted';
        }
        
        html += `
            <div class="loan-item">
                <h4>Loan #${loan.loanId}</h4>
                <p><strong>Principal:</strong> ${loan.principal} Wei</p>
                <p><strong>Interest Rate:</strong> ${loan.interestRate}%</p>
                <p><strong>Issue Date:</strong> ${issueDate.toLocaleDateString()}</p>
                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                <p><strong>Repaid Amount:</strong> ${loan.repaidAmount} Wei</p>
                <p><strong>Remaining:</strong> ${Math.max(0, parseInt(loan.principal) - parseInt(loan.repaidAmount))} Wei</p>
                <span class="loan-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load Admin Dashboard with all users and their loans
async function loadAdminDashboard() {
    const adminDashboard = document.getElementById('adminDashboard');
    if (!adminDashboard) return;
    
    try {
        let loanCount = 0;
        
        try {
            const countBig = await contract.getLoanCount?.();
            if (countBig) {
                loanCount = parseInt(countBig.toString());
            }
        } catch (e) {
            console.log("Loan count not available");
        }
        
        adminDashboard.innerHTML = `<div class="card"><h3>📊 Admin Panel</h3><p><strong>Total Loans:</strong> ${loanCount}</p></div>`;
    } catch (error) {
        console.error("Error loading admin dashboard:", error);
        adminDashboard.innerHTML = '<div class="card"><h3>📊 Admin Panel</h3><p>Ready</p></div>';
    }
}

// Load and display pending loan requests for admin approval
async function loadAdminRequests() {
    const pendingRequestsDiv = document.getElementById('pendingRequests');
    if (!pendingRequestsDiv || !contract) return;
    
    try {
        pendingRequestsDiv.innerHTML = '<p class="loading-text">Loading pending requests...</p>';
        
        // Query blockchain for LoanRequested events
        const filter = contract.filters.LoanRequested();
        const events = await contract.queryFilter(filter);
        
        if (events.length === 0) {
            pendingRequestsDiv.innerHTML = '<p class="loading-text">No loan requests found.</p>';
            return;
        }
        
        // Extract unique borrower addresses from events
        const borrowerAddresses = [...new Set(events.map(e => e.args.borrower))];
        
        let allRequests = [];
        
        // Fetch loan requests for each borrower
        for (const borrowerAddr of borrowerAddresses) {
            try {
                const requests = await contract.getLoanRequests(borrowerAddr);
                
                // Filter for active and unapproved requests
                requests.forEach((req, index) => {
                    if (req.isActive && !req.isApproved) {
                        allRequests.push({
                            borrower: borrowerAddr,
                            requestIndex: index,
                            requestId: req.requestId.toString(),
                            amount: ethers.formatEther(req.amount),
                            interestRate: req.interestRate.toString(),
                            durationDays: req.durationDays.toString(),
                            reason: req.reason
                        });
                    }
                });
            } catch (err) {
                console.error(`Error fetching requests for ${borrowerAddr}:`, err);
            }
        }
        
        // Display requests
        if (allRequests.length === 0) {
            pendingRequestsDiv.innerHTML = '<p class="loading-text">No pending requests at this time.</p>';
            return;
        }
        
        let html = '';
        allRequests.forEach(req => {
            html += `
                <div class="loan-card" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #444; border-radius: 8px; background: rgba(255,255,255,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0; color: #fff;">Request #${req.requestId}</h4>
                            <p style="margin: 0.25rem 0; color: #aaa; font-size: 0.9rem;">
                                <strong>Borrower:</strong> ${formatAddress(req.borrower)}
                            </p>
                            <p style="margin: 0.25rem 0; color: #aaa; font-size: 0.9rem;">
                                <strong>Amount:</strong> ${req.amount} ETH
                            </p>
                            <p style="margin: 0.25rem 0; color: #aaa; font-size: 0.9rem;">
                                <strong>Interest Rate:</strong> ${req.interestRate}%
                            </p>
                            <p style="margin: 0.25rem 0; color: #aaa; font-size: 0.9rem;">
                                <strong>Duration:</strong> ${req.durationDays} days
                            </p>
                            <p style="margin: 0.5rem 0 0 0; color: #ccc; font-style: italic;">
                                "${req.reason}"
                            </p>
                        </div>
                        <button 
                            class="btn btn-success" 
                            onclick="approveRequest('${req.borrower}', ${req.requestIndex})"
                            style="margin-left: 1rem; white-space: nowrap;">
                            <i class="fas fa-check"></i> Approve
                        </button>
                    </div>
                </div>
            `;
        });
        
        pendingRequestsDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading admin requests:", error);
        pendingRequestsDiv.innerHTML = '<p class="loading-text">Error loading requests.</p>';
    }
}

// Approve a loan request (called by button click)
async function approveRequest(borrowerAddress, requestIndex) {
    if (!isAdmin()) {
        alert("Admin only function");
        return;
    }
    
    if (!contract) {
        alert("Contract not initialized");
        return;
    }
    
    try {
        const confirmed = confirm(`Approve loan request from ${formatAddress(borrowerAddress)}?`);
        if (!confirmed) return;
        
        // Show loading state
        const pendingRequestsDiv = document.getElementById('pendingRequests');
        if (pendingRequestsDiv) {
            const originalHTML = pendingRequestsDiv.innerHTML;
            pendingRequestsDiv.innerHTML = '<p class="loading-text">Approving loan request...</p>';
        }
        
        const tx = await contract.approveLoan(borrowerAddress, requestIndex);
        const receipt = await tx.wait();
        
        alert(`✅ Loan approved! TX: ${receipt.hash}`);
        
        // Reload the requests list
        await loadAdminRequests();
        
    } catch (error) {
        console.error("Approval error:", error);
        alert(`Error: ${error.message || error}`);
        await loadAdminRequests(); // Reload to restore state
    }
}

// Show Status Message (defined in app.js)
// This function is overridden in app.js to target active tab's status message

// Format address
function formatAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(38);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Web3
    const web3Ready = await initWeb3();
    
    // Setup tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Setup wallet connection
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
});

// Switch Tab
function switchTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected tab
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}
