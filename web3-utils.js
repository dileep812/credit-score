// Web3 Utility Functions
let provider;
let signer;
let userAddress;
let contractAddress = CONFIG.CONTRACT_ADDRESS;
let contract = null;

// 1. ABI Definition
const CONTRACT_ABI = [
    "function registerUser(string _name) public",
    "function recordRepayment(uint256 _loanId) public payable",
    "function recordDefault(uint256 _loanId) public",
    "function recordLatePayment(uint256 _loanId) public",
    "function requestLoan(uint256 _amount, uint256 _interestRate, uint256 _durationDays, string memory _reason) public",
    "function approveLoan(address _borrower, uint256 _requestIndex) public payable",
    "function rejectLoan(address _borrower, uint256 _requestIndex, string memory _reason) public",
    "function getLoanRequests(address _user) public view returns (tuple(uint256 requestId, address borrower, uint256 amount, uint256 interestRate, uint256 durationDays, string reason, bool isApproved, bool isActive)[])",
    "function getCreditScore(address _user) public view returns (uint256)",
    "function getCreditScoreBreakdown(address _user) public view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
    "function getFinancialHistory(address _user) public view returns (tuple(string activityType, uint256 amount, string description, uint256 timestamp)[])",
    "function getUserLoans(address _user) public view returns (tuple(uint256 loanId, address borrower, uint256 principal, uint256 interestRate, uint256 issueDate, uint256 dueDate, uint256 repaidAmount, uint256 totalAmountToRepay, bool isRepaid, bool isDefaulted)[])",
    "function userExists(address _user) public view returns (bool)",
    "function getUserInfoBasic(address _user) public view returns (string memory name, uint256 creditScore, bool isActive, uint256 lastUpdated, uint256 stakedAmount)",
    "function getUserInfoStats(address _user) public view returns (uint256 totalLoans, uint256 totalRepayments, uint256 defaults, uint256 totalRequests, uint256 repaidLoansCount)",
    "function getAdmin() public view returns (address)",
    "function getLoanCount() public view returns (uint256)",
    "function calculateTotalDebt(address _user) public view returns (uint256)",
    "function stake() public payable",
    "function unstake(uint256 _amount) public",
    "function stakes(address _user) public view returns (uint256)",
    "function updateExternalScore(address _user, uint256 _score) public",
    "function externalScores(address _user) public view returns (uint256)",
    "function getAllUsers() public view returns (address[])",
    "event LoanRequested(uint256 indexed requestId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 durationDays, string reason)",
    "event LoanApproved(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower)",
    "event LoanRejected(uint256 indexed requestId, address indexed borrower, string reason, uint256 timestamp)",
    "event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interestRate, uint256 dueDate)",
    "event Staked(address indexed user, uint256 amount, uint256 timestamp)",
    "event Unstaked(address indexed user, uint256 amount, uint256 timestamp)",
    "event ExternalScoreUpdated(address indexed user, uint256 score, uint256 timestamp)"
];

// Error parsing helper function
function parseErrorMessage(error) {
    // Check for contract revert reason first
    if (error.reason) {
        return error.reason;
    }
    
    // Check for user rejection
    if (error.code === 'ACTION_REJECTED') {
        return 'User rejected transaction';
    }
    
    // Check for insufficient funds
    if (error.message && error.message.toLowerCase().includes('insufficient funds')) {
        return 'Insufficient ETH for gas';
    }
    
    // Check for other common error patterns
    if (error.message) {
        if (error.message.includes('execution reverted')) {
            return 'Transaction failed - check contract requirements';
        }
        if (error.message.includes('estimateGas')) {
            return 'Transaction would fail - check inputs';
        }
    }
    
    // Default fallback
    return 'Transaction Failed';
}

// Set contract address
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

function getContractAddress() { return contractAddress; }

// Initialize Web3
async function initWeb3() {
    if (window.ethereum) {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            window.ethereum.on('chainChanged', () => window.location.reload());
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) disconnectWallet();
                else { userAddress = accounts[0]; updateWalletStatus(); }
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
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }]
            });
        } catch (switchError) {
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
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        signer = await provider.getSigner();
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

function disconnectWallet() {
    userAddress = null;
    signer = null;
    updateWalletStatus();
    clearAllData();
    resetTabs();
}

function isAdmin() {
    return userAddress && userAddress.toLowerCase() === CONFIG.ADMIN_ADDRESS.toLowerCase();
}

// Update Wallet Status & Role UI
function updateWalletStatus() {
    const statusDiv = document.getElementById('walletStatus');
    const connectBtn = document.getElementById('connectWallet');
    
    if (userAddress) {
        const adminLabel = isAdmin() ? " 👑 (ADMIN)" : "";
        statusDiv.textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}${adminLabel}`;
        connectBtn.textContent = "Disconnect";
        connectBtn.onclick = disconnectWallet;
        loadUserData(); 
    } else {
        statusDiv.textContent = 'Not connected';
        connectBtn.textContent = 'Connect MetaMask';
        connectBtn.onclick = connectWallet;
        resetTabs();
    }
}

function resetTabs() {
    const userTabs = ['dashboard', 'register', 'history', 'loans', 'requestLoan', 'collateral'];
    userTabs.forEach(t => {
        const btn = document.querySelector(`[data-tab="${t}"]`);
        if (btn) btn.style.display = 'flex';
    });
    const adminBtn = document.querySelector(`[data-tab="admin"]`);
    if (adminBtn) adminBtn.style.display = 'none';
    
    // Reset Repayment Form visibility
    const repaymentForm = document.getElementById('repaymentForm');
    if(repaymentForm) {
        const card = repaymentForm.closest('.card');
        if(card) card.style.display = 'block';
    }

    // Reset Titles
    const loansHeader = document.querySelector('#loans .card-large h2');
    if(loansHeader) loansHeader.innerHTML = '<i class="fas fa-credit-card"></i> Your Loans';

    switchTab('dashboard');
}

function clearAllData() {
    document.getElementById('creditScore').textContent = '-';
    document.getElementById('scoreDescription').textContent = 'Connect wallet';
    document.getElementById('scoreBreakdown').innerHTML = '<p>Connect wallet</p>';
    document.getElementById('userProfile').innerHTML = '<p>Connect wallet</p>';
    document.getElementById('financialHistory').innerHTML = '<p>Connect wallet</p>';
    document.getElementById('loansList').innerHTML = '<p>Connect wallet</p>';
}

// ========== CORE DATA LOADING ==========
async function loadUserData() {
    if (!userAddress || !contract) return;

    try {
        // 1. Handle ADMIN View
        if (isAdmin()) {
            console.log("Admin detected. Configuring UI...");
            
            // UI Adjustments for Admin
            const adminBtn = document.querySelector('[data-tab="admin"]');
            if (adminBtn) adminBtn.style.display = 'flex';
            
            const registryBtn = document.querySelector('[data-tab="registry"]');
            if (registryBtn) registryBtn.style.display = 'flex';

            // Hide User-Specific Tabs
            ['dashboard', 'requestLoan', 'register', 'collateral'].forEach(t => {
                const btn = document.querySelector(`[data-tab="${t}"]`);
                if (btn) btn.style.display = 'none';
            });
            
            // Hide Repayment Form for Admin (As requested)
            const repaymentForm = document.getElementById('repaymentForm');
            if(repaymentForm) {
                const card = repaymentForm.closest('.card');
                if(card) card.style.display = 'none';
            }

            // Change "Your Loans" Title to "All System Loans"
            const loansHeader = document.querySelector('#loans .card-large h2');
            if(loansHeader) loansHeader.innerHTML = '<i class="fas fa-database"></i> All System Loans';

            // Force switch to Admin Tab
            switchTab('admin');

            // Load Admin Data
            loadAdminDashboard();
            loadUserRegistry();
            loadAdminRequests();
            loadAdminHistory();
            loadAllSystemLoans(); // NEW: Load ALL loans for Admin
            
            return; 
        }

        // 2. Handle USER View
        const adminBtn = document.querySelector('[data-tab="admin"]');
        if (adminBtn) adminBtn.style.display = 'none';

        // Restore UI for Regular User
        const repaymentForm = document.getElementById('repaymentForm');
        if(repaymentForm) {
            const card = repaymentForm.closest('.card');
            if(card) card.style.display = 'block';
        }
        const loansHeader = document.querySelector('#loans .card-large h2');
        if(loansHeader) loansHeader.innerHTML = '<i class="fas fa-credit-card"></i> Your Loans';

        // Show User Tabs
        ['dashboard', 'requestLoan', 'collateral'].forEach(t => {
            const btn = document.querySelector(`[data-tab="${t}"]`);
            if (btn) btn.style.display = 'flex';
        });

        // Check Registration
        let exists = await contract.userExists(userAddress);
        const registerBtn = document.querySelector('[data-tab="register"]');
        
        if (exists) {
            if (registerBtn) registerBtn.style.display = 'none';
            
            const regTab = document.getElementById('register');
            if (regTab && regTab.classList.contains('active')) {
                switchTab('dashboard');
            }

            // Load User Data
            const score = await contract.getCreditScore(userAddress);
            const scoreNum = Number(score);
            document.getElementById('creditScore').textContent = scoreNum;
            document.getElementById('scoreDescription').textContent = getScoreDescription(scoreNum);

            // Fetch user info using split functions
            const basic = await contract.getUserInfoBasic(userAddress);
            const stats = await contract.getUserInfoStats(userAddress);
            
            // Merge results
            const userInfo = {
                name: basic[0],
                creditScore: basic[1],
                isActive: basic[2],
                lastUpdated: basic[3],
                stakedAmount: basic[4],
                totalLoans: stats[0],
                totalRepayments: stats[1],
                defaults: stats[2],
                totalRequests: stats[3],
                repaidLoansCount: stats[4]
            };
            
            const timestamp = Number(userInfo.lastUpdated) * 1000;
            document.getElementById('lastUpdated').textContent = new Date(timestamp).toLocaleDateString();
            const statusEl = document.getElementById('scoreStatus');
            if (statusEl) statusEl.textContent = userInfo.isActive ? 'Active' : 'Inactive';

            const breakdown = await contract.getCreditScoreBreakdown(userAddress);
            displayScoreBreakdown({
                paymentHistoryScore: breakdown[0].toString(),
                repaymentConsistencyScore: breakdown[1].toString(),
                loanActivityScore: breakdown[2].toString(),
                collateralScore: breakdown[3].toString(),
                oracleScore: breakdown[4].toString(),
                totalScore: breakdown[5].toString()
            });

            const loans = await contract.getUserLoans(userAddress);
            displayUserLoans(loans); // Standard user display

            try {
                const history = await contract.getFinancialHistory(userAddress);
                // Calculate late payment count
                const latePaymentCount = history.filter(item => 
                    (item.activityType || item[0]) === "Late Payment"
                ).length;
                
                // Update profile with late payment count
                displayUserProfile({
                    name: userInfo.name,
                    totalLoans: userInfo.totalLoans.toString(),
                    totalRepayments: userInfo.totalRepayments.toString(),
                    defaults: userInfo.defaults.toString(),
                    totalRequests: userInfo.totalRequests.toString(),
                    latePayments: latePaymentCount.toString(),
                    isActive: userInfo.isActive,
                    lastUpdated: timestamp
                });
                
                displayFinancialHistory(history);
            } catch (hErr) {
                console.error("History Error:", hErr);
                document.getElementById('financialHistory').innerHTML = '<p>No history found.</p>';
                // If history fails, still display profile without late payments
                displayUserProfile({
                    name: userInfo.name,
                    totalLoans: userInfo.totalLoans.toString(),
                    totalRepayments: userInfo.totalRepayments.toString(),
                    defaults: userInfo.defaults.toString(),
                    totalRequests: userInfo.totalRequests.toString(),
                    latePayments: '0',
                    isActive: userInfo.isActive,
                    lastUpdated: timestamp
                });
            }
            
            // Load staking data
            loadStakingData();

        } else {
            if (registerBtn) registerBtn.style.display = 'flex';
            document.getElementById('creditScore').textContent = '-';
            document.getElementById('scoreDescription').textContent = 'Register first';
        }

    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// ========== NEW: FETCH ALL SYSTEM LOANS (ADMIN ONLY) ==========
async function loadAllSystemLoans() {
    const container = document.getElementById('loansList');
    if (!container) return;
    
    container.innerHTML = '<p class="loading-text">Scanning entire blockchain for loan records...</p>';
    
    try {
        // 1. Find all LoanCreated events to identify every borrower
        const filter = contract.filters.LoanCreated();
        const events = await contract.queryFilter(filter);
        
        if (events.length === 0) {
            container.innerHTML = '<p>No loans found in the system.</p>';
            return;
        }
        
        // 2. Get unique borrowers
        const borrowerAddresses = [...new Set(events.map(e => e.args.borrower))];
        
        let allLoans = [];
        
        // 3. Fetch up-to-date loan details for each borrower
        for (const borrower of borrowerAddresses) {
            try {
                const userLoans = await contract.getUserLoans(borrower);
                // Add borrower info to each loan object for display
                userLoans.forEach(loan => {
                    // Clone the loan object or create a new structure
                    allLoans.push({
                        loanId: loan.loanId,
                        borrower: borrower,
                        principal: loan.principal,
                        interestRate: loan.interestRate,
                        issueDate: loan.issueDate,
                        dueDate: loan.dueDate,
                        repaidAmount: loan.repaidAmount,
                        isRepaid: loan.isRepaid,
                        isDefaulted: loan.isDefaulted
                    });
                });
            } catch (e) {
                console.error("Error fetching loans for", borrower);
            }
        }
        
        // 4. Sort by Loan ID
        allLoans.sort((a, b) => Number(b.loanId) - Number(a.loanId));
        
        // 5. Display
        let html = '';
        allLoans.forEach((loan) => {
            const dueDate = new Date(Number(loan.dueDate) * 1000);
            let statusClass = 'status-active';
            let statusText = 'Active';
            
            if (loan.isRepaid) {
                statusClass = 'status-repaid';
                statusText = 'Closed (Repaid)';
            } else if (loan.isDefaulted) {
                statusClass = 'status-defaulted';
                statusText = 'Defaulted';
            }
            
            html += `
                <div class="loan-item" style="border-left: 4px solid #6366f1;">
                    <div style="display:flex; justify-content:space-between;">
                        <h4>Loan #${loan.loanId}</h4>
                        <small style="color:#aaa;">Borrower: ${formatAddress(loan.borrower)}</small>
                    </div>
                    <p><strong>Principal:</strong> ${ethers.formatEther(loan.principal.toString())} ETH</p>
                    <p><strong>Interest:</strong> ${loan.interestRate}%</p>
                    <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                    <p><strong>Repaid:</strong> ${ethers.formatEther(loan.repaidAmount.toString())} ETH</p>
                    <span class="loan-status ${statusClass}">${statusText}</span>
                </div>
            `;
        });
        container.innerHTML = html;
        
    } catch (error) {
        console.error("System Loans Error:", error);
        container.innerHTML = '<p>Error loading system loans.</p>';
    }
}

async function loadAdminHistory() {
    const container = document.getElementById('financialHistory');
    if (!container) return;
    container.innerHTML = '<p class="loading-text">Scanning blockchain for approved loans...</p>';

    try {
        const filter = contract.filters.LoanCreated();
        const events = await contract.queryFilter(filter); 
        if (events.length === 0) {
            container.innerHTML = '<p>No admin activity found.</p>';
            return;
        }
        events.sort((a, b) => b.blockNumber - a.blockNumber);

        let html = '';
        for (const event of events) {
            const block = await event.getBlock();
            const date = new Date(block.timestamp * 1000);
            const amount = ethers.formatEther(event.args.principal);
            const borrower = formatAddress(event.args.borrower);
            const loanId = event.args.loanId.toString();

            html += `
                <div class="history-item" style="border-left: 4px solid #ff6b6b;">
                    <h4>Loan Approved & Created</h4>
                    <span class="activity-type" style="background:#ff6b6b;">Admin Action</span>
                    <p class="activity-amount">${amount} ETH</p>
                    <p><small>Created Loan #${loanId} for ${borrower}</small></p>
                    <p><small>📅 ${date.toLocaleString()}</small></p>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p>Error loading admin history.</p>';
    }
}

// ========== DISPLAY FUNCTIONS ==========

function getScoreDescription(score) {
    if (score >= 750) return "Excellent Credit Score! ✅";
    if (score >= 700) return "Good Credit Score";
    if (score >= 650) return "Fair Credit Score";
    if (score >= 550) return "Poor Credit Score";
    return "Very Poor Credit Score";
}

function displayScoreBreakdown(data) {
    const container = document.getElementById('scoreBreakdown');
    const html = `
        <div class="breakdown-item"><h4>Payment History (Max 350)</h4><p>${data.paymentHistoryScore}</p></div>
        <div class="breakdown-item"><h4>Repayment Consistency (Max 250)</h4><p>${data.repaymentConsistencyScore}</p></div>
        <div class="breakdown-item"><h4>Loan Activity (Max 200)</h4><p>${data.loanActivityScore}</p></div>
        <div class="breakdown-item"><h4>Collateral Bonus (Max 50)</h4><p>${data.collateralScore}</p></div>
        <div class="breakdown-item"><h4>Oracle Bonus (Max 50)</h4><p>${data.oracleScore}</p></div>
        <div class="breakdown-item"><h4>Total Score (Max 900)</h4><p>${data.totalScore}</p></div>
    `;
    container.innerHTML = html;
}

function displayUserProfile(profile) {
    const container = document.getElementById('userProfile');
    // Convert totalRepayments from Wei to ETH
    const totalRepaymentsEth = ethers.formatEther(profile.totalRepayments.toString());
    const html = `
        <div class="profile-item"><label>Name</label><strong>${profile.name}</strong></div>
        <div class="profile-item"><label>Total Loans</label><strong>${profile.totalLoans}</strong></div>
        <div class="profile-item"><label>Total Requests</label><strong>${profile.totalRequests}</strong></div>
        <div class="profile-item"><label>Total Repayments</label><strong>${totalRepaymentsEth} ETH</strong></div>
        <div class="profile-item"><label>Defaults</label><strong>${profile.defaults}</strong></div>
        <div class="profile-item"><label>Late Payments</label><strong>${profile.latePayments}</strong></div>
    `;
    container.innerHTML = html;
}

function displayFinancialHistory(history) {
    const container = document.getElementById('financialHistory');
    if (!history || history.length === 0) {
        container.innerHTML = '<p>No financial history available</p>';
        return;
    }
    
    let html = '';
    for (let i = history.length - 1; i >= 0; i--) {
        const item = history[i];
        const type = item.activityType || item[0];
        const amount = item.amount || item[1];
        const desc = item.description || item[2];
        const time = item.timestamp || item[3];
        const timeNum = typeof time === 'bigint' ? Number(time) : Number(time);
        const date = new Date(timeNum * 1000);
        
        // Convert amount from Wei to ETH
        const amountEth = ethers.formatEther(amount.toString());
        
        html += `
            <div class="history-item">
                <h4>${type}</h4>
                <span class="activity-type">${type}</span>
                <p class="activity-amount">${amountEth} ETH</p>
                <p><small>${desc}</small></p>
                <p><small>📅 ${date.toLocaleString()}</small></p>
            </div>
        `;
    }
    container.innerHTML = html;
}

function displayUserLoans(loans) {
    const container = document.getElementById('loansList');
    if (!loans || loans.length === 0) {
        container.innerHTML = '<p>No loans available</p>';
        return;
    }
    let html = '';
    loans.forEach((loan) => {
        const dueDate = new Date(Number(loan.dueDate) * 1000);
        let statusClass = 'status-active';
        let statusText = 'Active';
        
        if (loan.isRepaid) {
            statusClass = 'status-repaid';
            statusText = 'Repaid';
        } else if (loan.isDefaulted) {
            statusClass = 'status-defaulted';
            statusText = 'Defaulted';
        }
        
        // Calculate remaining balance
        const totalAmount = loan.totalAmountToRepay || 0n;
        const repaidAmount = loan.repaidAmount || 0n;
        const remainingBalance = totalAmount - repaidAmount;
        
        const principalEth = ethers.formatEther(loan.principal.toString());
        const totalEth = ethers.formatEther(totalAmount.toString());
        const repaidEth = ethers.formatEther(repaidAmount.toString());
        const remainingEth = ethers.formatEther(remainingBalance.toString());
        
        html += `
            <div class="loan-item">
                <h4>Loan #${loan.loanId}</h4>
                <p><strong>Principal:</strong> ${principalEth} ETH</p>
                <p><strong>Interest Rate:</strong> ${loan.interestRate}%</p>
                <p><strong>Total Amount Owed:</strong> ${totalEth} ETH</p>
                <p><strong>Repaid:</strong> ${repaidEth} ETH</p>
                <p><strong>Remaining Balance:</strong> ${remainingEth} ETH</p>
                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                <span class="loan-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ========== ADMIN DASHBOARD ==========
async function loadAdminDashboard() {
    const adminDashboard = document.getElementById('adminDashboard');
    if (!adminDashboard) return;
    try {
        let countBig = "0";
        try { countBig = await contract.getLoanCount(); } catch(e) {}
        adminDashboard.innerHTML = `<div class="card"><h3>📊 Admin Panel</h3><p><strong>Total Loans in System:</strong> ${countBig}</p></div>`;
    } catch (error) {
        console.error("Admin Dash Error:", error);
    }
}

// ========== USER REGISTRY (ADMIN) ==========
async function loadUserRegistry() {
    const registryDiv = document.getElementById('userRegistry');
    if (!registryDiv || !contract) return;
    
    try {
        registryDiv.innerHTML = '<p class="loading-text">Fetching all registered users...</p>';
        
        const userAddresses = await contract.getAllUsers();
        
        if (userAddresses.length === 0) {
            registryDiv.innerHTML = '<p style="color:#aaa;">No users registered yet.</p>';
            return;
        }
        
        let html = '<div style="display: grid; gap: 0.75rem;">';
        
        for (const addr of userAddresses) {
            try {
                // Fetch user info using split functions
                const basic = await contract.getUserInfoBasic(addr);
                const stats = await contract.getUserInfoStats(addr);
                
                // Merge results
                const userInfo = {
                    name: basic[0],
                    creditScore: basic[1],
                    isActive: basic[2],
                    lastUpdated: basic[3],
                    stakedAmount: basic[4],
                    totalLoans: stats[0],
                    totalRepayments: stats[1],
                    defaults: stats[2],
                    totalRequests: stats[3],
                    repaidLoansCount: stats[4]
                };
                
                const score = Number(userInfo.creditScore);
                const stakedEth = ethers.formatEther(userInfo.stakedAmount);

                let scoreColor = '#4ade80'; // green
                if (score < 550) scoreColor = '#ff6b6b'; // red
                else if (score < 650) scoreColor = '#ffa500'; // orange
                else if (score < 700) scoreColor = '#ffeb3b'; // yellow

                html += `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid #333; border-radius: 8px; padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h4 style="margin: 0; color: #fff;">${userInfo.name}</h4>
                            <button class="btn btn-primary" onclick="copyAddress('${addr}')" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <p style="margin: 0.25rem 0; color: #888; font-size: 0.8rem; font-family: monospace;">
                            ${addr}
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
                            <div>
                                <p style="margin: 0; color: #aaa; font-size: 0.75rem;">Credit Score</p>
                                <p style="margin: 0.25rem 0 0 0; color: ${scoreColor}; font-size: 1.1rem; font-weight: bold;">${score}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #aaa; font-size: 0.75rem;">Staked</p>
                                <p style="margin: 0.25rem 0 0 0; color: #4ade80; font-size: 1.1rem; font-weight: bold;">${stakedEth} ETH</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #aaa; font-size: 0.75rem;">Total Loans</p>
                                <p style="margin: 0.25rem 0 0 0; color: #fff; font-size: 0.95rem;">${Number(userInfo.totalLoans)}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #aaa; font-size: 0.75rem;">Defaults</p>
                                <p style="margin: 0.25rem 0 0 0; color: ${Number(userInfo.defaults) > 0 ? '#ff6b6b' : '#4ade80'}; font-size: 0.95rem;">${Number(userInfo.defaults)}</p>
                            </div>
                        </div>
                    </div>
                `;
            } catch (err) {
                console.error("Error fetching user info for", addr, err);
            }
        }        html += '</div>';
        registryDiv.innerHTML = html;
        
    } catch (error) {
        console.error("User Registry Error:", error);
        registryDiv.innerHTML = '<p style="color:#ff6b6b;">Error loading user registry.</p>';
    }
}

// Copy address to clipboard
// REPLACE the existing copyAddress function with this robust version:

async function copyAddress(address) {
    // Find the button element (handle clicks on the icon or the button itself)
    const btn = event.target.closest('button');
    
    try {
        // Method 1: Modern Async API
        await navigator.clipboard.writeText(address);
        showCopySuccess(btn);
    } catch (err) {
        // Method 2: Fallback for older browsers or restricted contexts
        try {
            const textArea = document.createElement("textarea");
            textArea.value = address;
            
            // Ensure textarea is not visible but part of DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                showCopySuccess(btn);
            } else {
                throw new Error("Fallback failed");
            }
        } catch (fallbackErr) {
            // Method 3: Last resort - Show prompt
            console.error('Failed to copy:', fallbackErr);
            prompt("Browser blocked copy. Please Ctrl+C manually:", address);
        }
    }
}

// Helper to update button UI
function showCopySuccess(btn) {
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    const originalColor = btn.style.backgroundColor;
    
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    btn.style.backgroundColor = '#4ade80'; // Green
    btn.style.borderColor = '#4ade80';
    
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.backgroundColor = originalColor;
        btn.style.borderColor = '';
    }, 2000);
}
async function loadAdminRequests() {
    const pendingRequestsDiv = document.getElementById('pendingRequests');
    if (!pendingRequestsDiv || !contract) return;
    try {
        pendingRequestsDiv.innerHTML = '<p class="loading-text">Scanning for requests...</p>';
        const filter = contract.filters.LoanRequested();
        const events = await contract.queryFilter(filter);
        if (events.length === 0) {
            pendingRequestsDiv.innerHTML = '<p class="loading-text">No loan requests found.</p>';
            return;
        }
        const borrowerAddresses = [...new Set(events.map(e => e.args.borrower))];
        let allRequests = [];
        for (const borrowerAddr of borrowerAddresses) {
            try {
                const requests = await contract.getLoanRequests(borrowerAddr);
                requests.forEach((req, index) => {
                    if (req.isActive && !req.isApproved) {
                        allRequests.push({
                            borrower: borrowerAddr,
                            requestIndex: index,
                            requestId: req.requestId.toString(),
                            amount: ethers.formatEther(req.amount),
                            amountWei: req.amount.toString(),
                            interestRate: req.interestRate.toString(),
                            durationDays: req.durationDays.toString(),
                            reason: req.reason
                        });
                    }
                });
            } catch (err) {}
        }
        if (allRequests.length === 0) {
            pendingRequestsDiv.innerHTML = '<p class="loading-text">No pending requests.</p>';
            return;
        }
        let html = '';
        allRequests.forEach(req => {
            html += `
                <div class="loan-card" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #444; border-radius: 8px; background: rgba(255,255,255,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0; color: #fff;">Request #${req.requestId}</h4>
                            <p style="margin:0; color: #aaa;"><strong>Borrower:</strong> ${formatAddress(req.borrower)}</p>
                            <p style="margin:0; color: #aaa;"><strong>Amount:</strong> ${req.amount} ETH</p>
                            <p style="margin:0; color: #aaa;"><strong>Reason:</strong> "${req.reason}"</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-success" onclick="approveRequest('${req.borrower}', ${req.requestIndex}, '${req.amountWei}')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn" style="background-color: #dc2626; border-color: #dc2626;" onclick="rejectRequest('${req.borrower}', ${req.requestIndex})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        pendingRequestsDiv.innerHTML = html;
    } catch (error) {
        pendingRequestsDiv.innerHTML = '<p class="loading-text">Error loading requests.</p>';
    }
}

async function approveRequest(borrowerAddress, requestIndex, amountWei) {
    if (!isAdmin() || !contract) return;
    const amountEth = ethers.formatEther(amountWei);
    if (!confirm(`Approve loan for ${formatAddress(borrowerAddress)}?\n\nYou will send: ${amountEth} ETH`)) return;
    try {
        document.getElementById('pendingRequests').innerHTML = '<p class="loading-text">Approving and funding loan...</p>';
        const tx = await contract.approveLoan(borrowerAddress, requestIndex, { value: amountWei });
        await tx.wait();
        alert(`✅ Loan approved and ${amountEth} ETH sent to borrower!`);
        loadAdminRequests();
        loadAdminHistory();
        loadAllSystemLoans(); 
    } catch (error) {
        alert(`Error: ${error.message || error}`);
        loadAdminRequests();
    }
}

async function rejectRequest(borrowerAddress, requestIndex) {
    if (!isAdmin() || !contract) return;
    const reason = prompt(`Enter rejection reason for ${formatAddress(borrowerAddress)}:`);
    if (!reason || reason.trim() === '') {
        alert('Rejection reason is required.');
        return;
    }
    try {
        document.getElementById('pendingRequests').innerHTML = '<p class="loading-text">Rejecting...</p>';
        const tx = await contract.rejectLoan(borrowerAddress, requestIndex, reason);
        await tx.wait();
        alert(`❌ Loan request rejected.`);
        loadAdminRequests();
        loadAdminHistory();
    } catch (error) {
        alert(`Error: ${error.message || error}`);
        loadAdminRequests();
    }
}

function formatAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(38);
}

// ========== STAKING DISPLAY FUNCTIONS ==========
async function loadStakingData() {
    if (!userAddress || !contract) return;
    
    const stakingInfo = document.getElementById('stakingInfo');
    if (!stakingInfo) return;
    
    try {
        // Fetch staked amount
        const stakedAmount = await contract.stakes(userAddress);
        const stakedEth = ethers.formatEther(stakedAmount.toString());
        
        // Calculate total debt from active and defaulted loans
        const userLoansArray = await contract.getUserLoans(userAddress);
        let totalDebt = 0n;
        
        for (let loan of userLoansArray) {
            if (!loan.isRepaid) {
                const remainingDebt = loan.totalAmountToRepay - loan.repaidAmount;
                totalDebt += remainingDebt;
            }
        }
        
        const debtEth = ethers.formatEther(totalDebt.toString());
        
        // Calculate available to unstake
        let availableAmount = 0n;
        if (stakedAmount > totalDebt) {
            availableAmount = stakedAmount - totalDebt;
        }
        const availableEth = ethers.formatEther(availableAmount.toString());
        
        // Display debt-aware staking information
        stakingInfo.innerHTML = `
            <div class="card">
                <h3>💰 Collateral Status</h3>
                <div style="margin: 15px 0;">
                    <p style="font-size: 0.9rem; color: #aaa; margin: 5px 0;">Total Staked:</p>
                    <p class="activity-amount" style="font-size: 1.8rem; color: #4ade80; margin: 5px 0;">${stakedEth} ETH</p>
                </div>
                <div style="margin: 15px 0;">
                    <p style="font-size: 0.9rem; color: #aaa; margin: 5px 0;">Locked for Debt:</p>
                    <p class="activity-amount" style="font-size: 1.5rem; color: #f59e0b; margin: 5px 0;">${debtEth} ETH</p>
                </div>
                <div style="margin: 15px 0; padding: 15px; background: rgba(74, 222, 128, 0.1); border-radius: 8px;">
                    <p style="font-size: 0.9rem; color: #aaa; margin: 5px 0;">Available to Unstake:</p>
                    <p class="activity-amount" style="font-size: 2rem; color: #10b981; margin: 5px 0; font-weight: bold;">${availableEth} ETH</p>
                </div>
                <p style="color: #aaa; font-size: 0.85rem; margin-top: 15px;">
                    ${totalDebt > 0n 
                        ? "⚠️ Collateral locked until loans are repaid or defaulted" 
                        : "✅ No active debt - full amount available"}
                </p>
                <p style="color: #aaa; font-size: 0.85rem; margin-top: 8px;">
                    💡 Staking 1 ETH = +50 credit score points (proportional)
                </p>
            </div>
        `;
    } catch (error) {
        console.error("Error loading staking data:", error);
        stakingInfo.innerHTML = '<p>Error loading staking data</p>';
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await initWeb3();
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.getAttribute('data-tab'));
        });
    });
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    const content = document.getElementById(tabName);
    if (content) content.classList.add('active');
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
}