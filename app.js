// ========== VALIDATION HELPERS ==========
const Validators = {
    isPositiveNumber: (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
    },
    isPositiveInteger: (val) => {
        const num = Number(val);
        return Number.isInteger(num) && num > 0;
    },
    isValidPercentage: (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 100;
    },
    isValidLoanId: (val) => {
        const num = Number(val);
        return Number.isInteger(num) && num > 0;
    },
    isValidAddress: (val) => {
        return ethers.isAddress(val);
    }
};

// ========== HELPER: Display Status Message ==========
function displayStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = 'status-message ' + type;
        element.style.display = 'block';
    }
}

// ========== USER REGISTRATION ==========
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        displayStatus('registerStatus', "Please connect your wallet first", "error");
        return;
    }
    
    if (!contract) {
        displayStatus('registerStatus', "Contract not initialized", "error");
        return;
    }
    
    const name = document.getElementById('userName').value.trim();
    
    if (!name) {
        displayStatus('registerStatus', "Please enter your name", "error");
        return;
    }
    
    try {
        displayStatus('registerStatus', "Registering on blockchain...", "loading");
        
        const tx = await contract.registerUser(name);
        const receipt = await tx.wait();
        
        displayStatus('registerStatus', `✅ Registration successful! TX: ${receipt.hash}`, "success");
        document.getElementById('userName').value = '';
        
        setTimeout(() => {
            loadUserData();
        }, 2000);
    } catch (error) {
        console.error("Error:", error);
        displayStatus('registerStatus', parseErrorMessage(error), "error");
    }
});

// ========== REPAYMENT FORM ==========
document.getElementById('repaymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        displayStatus('repaymentStatus', "Please connect your wallet first", "error");
        return;
    }
    
    if (!contract) {
        displayStatus('repaymentStatus', "Contract not initialized", "error");
        return;
    }
    
    const loanId = document.getElementById('loanId').value.trim();
    const amount = document.getElementById('repaymentAmount').value.trim();
    
    if (!Validators.isValidLoanId(loanId)) {
        displayStatus('repaymentStatus', "Please enter a valid Loan ID (Positive Integer)", "error");
        return;
    }

    if (!Validators.isPositiveNumber(amount)) {
        displayStatus('repaymentStatus', "Repayment amount must be greater than 0", "error");
        return;
    }
    
    try {
        displayStatus('repaymentStatus', "Recording repayment...", "loading");
        
        const amountInWei = ethers.parseEther(amount);
        const tx = await contract.recordRepayment(parseInt(loanId), { value: amountInWei });
        const receipt = await tx.wait();
        
        displayStatus('repaymentStatus', `✅ Repayment recorded! TX: ${receipt.hash}`, "success");
        document.getElementById('loanId').value = '';
        document.getElementById('repaymentAmount').value = '';
        
        setTimeout(() => {
            loadUserData();
        }, 2000);
    } catch (error) {
        console.error("Error:", error);
        displayStatus('repaymentStatus', parseErrorMessage(error), "error");
    }
});

// ========== REQUEST LOAN FORM ==========
document.getElementById('requestLoanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        displayStatus('requestLoanStatus', "Please connect your wallet first", "error");
        return;
    }
    
    if (!contract) {
        displayStatus('requestLoanStatus', "Contract not initialized", "error");
        return;
    }
    
    const amount = document.getElementById('requestAmount').value.trim();
    const interestRate = document.getElementById('requestInterestRate').value.trim();
    const durationDays = document.getElementById('requestDurationDays').value.trim();
    const reason = document.getElementById('requestReason').value.trim();
    
    if (!Validators.isPositiveNumber(amount)) {
        displayStatus('requestLoanStatus', "Loan Amount must be greater than 0", "error");
        return;
    }

    if (!Validators.isValidPercentage(interestRate) || parseFloat(interestRate) <= 0) {
        displayStatus('requestLoanStatus', "Interest Rate must be between 0% and 100%", "error");
        return;
    }

    if (!Validators.isPositiveInteger(durationDays)) {
        displayStatus('requestLoanStatus', "Duration must be a valid number of days (Integer)", "error");
        return;
    }

    if (!reason || reason.length < 5) {
        displayStatus('requestLoanStatus', "Please provide a clearer reason (min 5 chars)", "error");
        return;
    }
    
    try {
        displayStatus('requestLoanStatus', "Submitting loan request...", "loading");
        
        const amountInWei = ethers.parseEther(amount);
        const tx = await contract.requestLoan(
            amountInWei,
            parseInt(interestRate),
            parseInt(durationDays),
            reason
        );
        const receipt = await tx.wait();
        
        displayStatus('requestLoanStatus', `✅ Loan request submitted! TX: ${receipt.hash}`, "success");
        document.getElementById('requestLoanForm').reset();
        
        setTimeout(() => {
            loadUserData();
        }, 2000);
    } catch (error) {
        console.error("Loan request error:", error);
        displayStatus('requestLoanStatus', parseErrorMessage(error), "error");
    }
});

// ========== REFRESH CREDIT SCORE ==========
if (document.getElementById('refreshScore')) {
    document.getElementById('refreshScore').addEventListener('click', async () => {
        if (!userAddress) return;
        
        try {
            displayStatus('dashboardStatus', "Refreshing credit score...", "loading");
            loadUserData();
            displayStatus('dashboardStatus', "Credit score updated", "success");
        } catch (error) {
            displayStatus('dashboardStatus', parseErrorMessage(error), "error");
        }
    });
}

// ========== ADMIN FUNCTIONS ==========
function initAdminForms() {
    // ===== RECORD DEFAULT (Admin Only) =====
    const recordDefaultForm = document.getElementById('recordDefaultForm');
    if (recordDefaultForm) {
        recordDefaultForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAdmin()) {
                displayStatus('recordDefaultStatus', "Admin only function", "error");
                return;
            }
            
            if (!contract) {
                displayStatus('recordDefaultStatus', "Contract not initialized", "error");
                return;
            }
            
            const loanId = document.getElementById('defaultLoanId').value.trim();
            
            if (!Validators.isValidLoanId(loanId)) {
                displayStatus('recordDefaultStatus', "Please enter valid Loan ID (Integer > 0)", "error");
                return;
            }
            
            try {
                displayStatus('recordDefaultStatus', "Recording default on blockchain...", "loading");
                
                const tx = await contract.recordDefault(parseInt(loanId));
                const receipt = await tx.wait();
                
                displayStatus('recordDefaultStatus', `✅ Default recorded for Loan #${loanId}! TX: ${receipt.hash}`, "success");
                recordDefaultForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                }, 2000);
            } catch (error) {
                console.error("Default recording error:", error);
                displayStatus('recordDefaultStatus', parseErrorMessage(error), "error");
            }
        });
    }
    
    // ===== RECORD LATE PAYMENT (Admin Only) =====
    const recordLatePaymentForm = document.getElementById('recordLatePaymentForm');
    if (recordLatePaymentForm) {
        recordLatePaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAdmin()) {
                displayStatus('recordLatePaymentStatus', "Admin only function", "error");
                return;
            }
            
            if (!contract) {
                displayStatus('recordLatePaymentStatus', "Contract not initialized", "error");
                return;
            }
            
            const loanId = document.getElementById('lateLoanId').value.trim();
            
            if (!Validators.isValidLoanId(loanId)) {
                displayStatus('recordLatePaymentStatus', "Please enter valid Loan ID (Integer > 0)", "error");
                return;
            }
            
            try {
                displayStatus('recordLatePaymentStatus', "Recording late payment on blockchain...", "loading");
                
                const tx = await contract.recordLatePayment(parseInt(loanId));
                const receipt = await tx.wait();
                
                displayStatus('recordLatePaymentStatus', `✅ Late payment recorded for Loan #${loanId}! TX: ${receipt.hash}`, "success");
                recordLatePaymentForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                }, 2000);
            } catch (error) {
                console.error("Late payment recording error:", error);
                displayStatus('recordLatePaymentStatus', parseErrorMessage(error), "error");
            }
        });
    }
}

// ========== COLLATERAL MANAGEMENT ==========
function initCollateralForms() {
    const stakeForm = document.getElementById('stakeForm');
    if (stakeForm) {
        stakeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!userAddress) {
                displayStatus('stakeStatus', 'Connect wallet first', 'error');
                return;
            }
            
            if (!contract) {
                displayStatus('stakeStatus', 'Contract not initialized', 'error');
                return;
            }
            
            const amt = document.getElementById('stakeAmount').value.trim();
            
            if (!Validators.isPositiveNumber(amt)) {
                displayStatus('stakeStatus', 'Stake amount must be a positive value', 'error');
                return;
            }
            
            try {
                displayStatus('stakeStatus', 'Staking ETH...', 'loading');
                
                const wei = ethers.parseEther(amt);
                const tx = await contract.stake({ value: wei });
                const receipt = await tx.wait();
                
                displayStatus('stakeStatus', `✅ Staked ${amt} ETH (TX: ${receipt.hash})`, 'success');
                stakeForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                    loadStakingData();
                }, 1500);
            } catch (err) {
                console.error(err);
                displayStatus('stakeStatus', parseErrorMessage(err), 'error');
            }
        });
    }
    
    const unstakeForm = document.getElementById('unstakeForm');
    if (unstakeForm) {
        unstakeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!userAddress) {
                displayStatus('unstakeStatus', 'Connect wallet first', 'error');
                return;
            }
            
            if (!contract) {
                displayStatus('unstakeStatus', 'Contract not initialized', 'error');
                return;
            }
            
            const amt = document.getElementById('unstakeAmount').value.trim();
            
            if (!Validators.isPositiveNumber(amt)) {
                displayStatus('unstakeStatus', 'Unstake amount must be a positive value', 'error');
                return;
            }
            
            try {
                displayStatus('unstakeStatus', 'Unstaking ETH...', 'loading');
                
                const wei = ethers.parseEther(amt);
                const tx = await contract.unstake(wei);
                const receipt = await tx.wait();
                
                displayStatus('unstakeStatus', `✅ Unstaked ${amt} ETH (TX: ${receipt.hash})`, 'success');
                unstakeForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                    loadStakingData();
                }, 1500);
            } catch (err) {
                console.error(err);
                displayStatus('unstakeStatus', parseErrorMessage(err), 'error');
            }
        });
    }
}

// ========== ORACLE UPDATE FORM (ADMIN) ==========
function initOracleForm() {
    const oracleForm = document.getElementById('oracleUpdateForm');
    if (!oracleForm) return;
    
    oracleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isAdmin()) {
            displayStatus('oracleUpdateStatus', 'Admin only function', 'error');
            return;
        }
        
        if (!contract) {
            displayStatus('oracleUpdateStatus', 'Contract not initialized', 'error');
            return;
        }
        
        const userAddr = document.getElementById('oracleUserAddress').value.trim();
        const scoreStr = document.getElementById('oracleScore').value.trim();
        
        if (!Validators.isValidAddress(userAddr)) {
            displayStatus('oracleUpdateStatus', 'Invalid Ethereum address', 'error');
            return;
        }
        
        if (!scoreStr) {
            displayStatus('oracleUpdateStatus', 'Enter score', 'error');
            return;
        }
        
        const score = parseInt(scoreStr);
        if (score < 0 || score > 50) {
            displayStatus('oracleUpdateStatus', 'Score must be between 0 and 50', 'error');
            return;
        }
        
        try {
            displayStatus('oracleUpdateStatus', 'Updating external score...', 'loading');
            
            const tx = await contract.updateExternalScore(userAddr, score);
            const receipt = await tx.wait();
            
            displayStatus('oracleUpdateStatus', `✅ External score updated (TX: ${receipt.hash})`, 'success');
            oracleForm.reset();
            
            setTimeout(() => {
                loadUserData();
            }, 1500);
        } catch (err) {
            console.error(err);
            displayStatus('oracleUpdateStatus', parseErrorMessage(err), 'error');
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAdminForms();
    initCollateralForms();
    initOracleForm();
});

// ========== DATA LOADING ==========
async function loadUserData() {
    if (!userAddress || !contract) return;
    
    try {
        // Check if user is admin (using global isAdmin() from web3-utils.js)
        if (isAdmin()) {
            // Admin Dashboard
            await loadAdminDashboard();
            await loadUserRegistry();
            await loadAdminRequests();
            await loadAllSystemLoans();
            
            // STRICT ADMIN VIEW: Hide ALL user-specific tabs
            const userTabs = ['dashboard', 'register', 'history', 'loans', 'requestLoan', 'collateral'];
            userTabs.forEach(tabName => {
                const tab = document.querySelector(`[data-tab="${tabName}"]`);
                if (tab) tab.style.display = 'none';
            });
            
            // Show ONLY admin tabs
            document.querySelectorAll('[data-tab="admin"], [data-tab="registry"]').forEach(tab => {
                tab.style.display = '';
            });
            
            // Force switch to admin tab
            const adminTab = document.querySelector('[data-tab="admin"]');
            const adminContent = document.getElementById('admin');
            if (adminTab && adminContent) {
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                document.querySelectorAll('.tab-button').forEach(tb => tb.classList.remove('active'));
                adminContent.classList.add('active');
                adminTab.classList.add('active');
            }
        } else {
            // Regular User Dashboard
            const exists = await contract.userExists(userAddress);
            const registerTab = document.querySelector('[data-tab="register"]');
            
            if (!exists) {
                // User does NOT exist - Show register tab and switch to it
                if (registerTab) registerTab.style.display = 'flex';
                
                document.getElementById('scoreDescription').textContent = 'Please register to view your credit score';
                
                // Force switch to register tab
                const registerTabContent = document.getElementById('register');
                if (registerTabContent) {
                    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    document.querySelectorAll('.tab-button').forEach(tb => tb.classList.remove('active'));
                    registerTabContent.classList.add('active');
                    if (registerTab) registerTab.classList.add('active');
                }
                return;
            }
            
            // User EXISTS - Hide register tab strictly
            if (registerTab) registerTab.style.display = 'none';
            
            // If currently viewing register tab, switch to dashboard
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'register') {
                const dashboardTab = document.querySelector('[data-tab="dashboard"]');
                const dashboardContent = document.getElementById('dashboard');
                if (dashboardTab && dashboardContent) {
                    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    document.querySelectorAll('.tab-button').forEach(tb => tb.classList.remove('active'));
                    dashboardContent.classList.add('active');
                    dashboardTab.classList.add('active');
                }
            }
            
            // Fetch credit score
            const creditScore = await contract.getCreditScore(userAddress);
            const scoreNum = Number(creditScore);
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

            displayUserProfile(userInfo);

            // Fetch and display user loans
            const loans = await contract.getUserLoans(userAddress);
            displayUserLoans(loans);

            // Fetch and display financial history
            const history = await contract.getFinancialHistory(userAddress);
            displayFinancialHistory(history);
            
            // Load staking data
            await loadStakingData();
            
            // Show refresh button
            const refreshBtn = document.getElementById('refreshScore');
            if (refreshBtn) refreshBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// ========== ADMIN DASHBOARD ==========
async function loadAdminDashboard() {
    try {
        const loanCount = await contract.getLoanCount();
        console.log('Total loans in system:', loanCount.toString());
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

// ========== LOAD USER REGISTRY (ADMIN) ==========
async function loadUserRegistry() {
    const registryDiv = document.getElementById('userRegistry');
    if (!registryDiv) return;
    
    try {
        const userAddresses = await contract.getAllUsers();
        
        if (userAddresses.length === 0) {
            registryDiv.innerHTML = '<p style="color: #888;">No registered users yet.</p>';
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
                        <p style="color: #888; font-size: 0.85rem; margin: 0.25rem 0;">${formatAddress(addr)}</p>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
                            <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px;">
                                <div style="font-size: 0.75rem; color: #888;">Score</div>
                                <div style="font-size: 1.25rem; font-weight: bold; color: ${scoreColor};">${score}</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px;">
                                <div style="font-size: 0.75rem; color: #888;">Staked</div>
                                <div style="font-size: 1.25rem; font-weight: bold; color: #4ade80;">${parseFloat(stakedEth).toFixed(4)} ETH</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px;">
                                <div style="font-size: 0.75rem; color: #888;">Total Loans</div>
                                <div style="font-size: 1.25rem; font-weight: bold; color: #60a5fa;">${userInfo.totalLoans.toString()}</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px;">
                                <div style="font-size: 0.75rem; color: #888;">Defaults</div>
                                <div style="font-size: 1.25rem; font-weight: bold; color: #ff6b6b;">${userInfo.defaults.toString()}</div>
                            </div>
                        </div>
                    </div>
                `;
            } catch (err) {
                console.error('Error loading user:', addr, err);
            }
        }
        
        html += '</div>';
        registryDiv.innerHTML = html;
    } catch (error) {
        console.error('Error loading user registry:', error);
        registryDiv.innerHTML = '<p style="color: #ff6b6b;">Error loading users</p>';
    }
}

// ========== LOAD ADMIN REQUESTS (PENDING LOANS) ==========
async function loadAdminRequests() {
    const requestsDiv = document.getElementById('pendingRequests');
    if (!requestsDiv) {
        console.error('pendingRequests container not found');
        return;
    }
    
    if (!contract) {
        console.error('Contract not initialized');
        requestsDiv.innerHTML = '<p style="color: #ff6b6b;">Contract not initialized. Please refresh.</p>';
        return;
    }
    
    try {
        requestsDiv.innerHTML = '<p class="loading-text">Loading pending requests...</p>';
        
        console.log('Fetching all users...');
        const allUsers = await contract.getAllUsers();
        console.log('Total users:', allUsers.length);
        
        let allRequests = [];
        
        for (const userAddr of allUsers) {
            try {
                const userRequests = await contract.getLoanRequests(userAddr);
                console.log(`User ${userAddr} has ${userRequests.length} requests`);
                
                for (let i = 0; i < userRequests.length; i++) {
                    const req = userRequests[i];
                    console.log(`Request ${i}:`, {
                        requestId: req.requestId.toString(),
                        borrower: req.borrower,
                        amount: req.amount.toString(),
                        interestRate: req.interestRate.toString(),
                        durationDays: req.durationDays.toString(),
                        reason: req.reason,
                        isApproved: req.isApproved,
                        isActive: req.isActive
                    });
                    
                    // Check if request is pending (active and not approved)
                    if (req.isActive && !req.isApproved) {
                        allRequests.push({
                            requestId: req.requestId,
                            borrower: req.borrower,
                            amount: req.amount,
                            interestRate: req.interestRate,
                            durationDays: req.durationDays,
                            reason: req.reason,
                            isApproved: req.isApproved,
                            isActive: req.isActive,
                            borrowerAddress: userAddr,
                            requestIndex: i
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching requests for user:', userAddr, err);
            }
        }
        
        console.log('Total pending requests:', allRequests.length);
        
        if (allRequests.length === 0) {
            requestsDiv.innerHTML = '<p style="color: #888;">No pending loan requests. Users can submit requests in the "Request Loan" tab.</p>';
            return;
        }
        
        let html = '<div style="display: grid; gap: 1rem;">';
        
        for (const req of allRequests) {
            try {
                const amountEth = ethers.formatEther(req.amount);
                const borrowerName = await getUserName(req.borrowerAddress);
                
                html += `
                    <div class="loan-card" style="background: rgba(255,255,255,0.03); border: 1px solid #444; border-radius: 8px; padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                            <div>
                                <h4 style="margin: 0; color: #fff;">Request #${req.requestId.toString()}</h4>
                                <p style="color: #888; font-size: 0.85rem; margin: 0.25rem 0;">${borrowerName} (${formatAddress(req.borrowerAddress)})</p>
                            </div>
                            <span class="badge" style="background: #ffa500; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">PENDING</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
                            <div>
                                <div style="font-size: 0.75rem; color: #888;">Amount</div>
                                <div style="font-weight: bold; color: #4ade80;">${amountEth} ETH</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: #888;">Interest Rate</div>
                                <div style="font-weight: bold;">${req.interestRate.toString()}%</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: #888;">Duration</div>
                                <div style="font-weight: bold;">${req.durationDays.toString()} days</div>
                            </div>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Reason:</div>
                            <div style="color: #ccc; font-size: 0.9rem;">${req.reason}</div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-success" onclick="approveRequest('${req.borrowerAddress}', ${req.requestIndex}, '${req.amount.toString()}')" style="flex: 1;">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn btn-danger" onclick="rejectRequest('${req.borrowerAddress}', ${req.requestIndex})" style="flex: 1;">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </div>
                `;
            } catch (err) {
                console.error('Error rendering request:', err);
            }
        }
        
        html += '</div>';
        requestsDiv.innerHTML = html;
        console.log('Successfully rendered pending requests');
        
    } catch (error) {
        console.error('Error loading admin requests:', error);
        console.error('Error details:', error.message, error.code);
        requestsDiv.innerHTML = `<p style="color: #ff6b6b;">Error loading requests: ${error.message || 'Unknown error'}</p>`;
    }
}

// Make approve/reject globally accessible
window.approveRequest = async function(borrowerAddress, requestIndex, amountWei) {
    if (!isAdmin() || !contract) return;
    
    try {
        document.getElementById('pendingRequests').innerHTML = '<p class="loading-text">Approving loan...</p>';
        
        const tx = await contract.approveLoan(borrowerAddress, requestIndex, { value: BigInt(amountWei) });
        await tx.wait();
        
        alert(`✅ Loan approved and funded!`);
        loadAdminRequests();
        loadAllSystemLoans(); 
    } catch (error) {
        alert(`Error: ${error.message || error}`);
        loadAdminRequests();
    }
}

window.rejectRequest = async function(borrowerAddress, requestIndex) {
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
        const stakedEth = ethers.formatEther(stakedAmount);
        
        // Calculate total debt
        const totalDebt = await contract.calculateTotalDebt(userAddress);
        const debtEth = ethers.formatEther(totalDebt);
        
        // Calculate available
        const availableWei = stakedAmount >= totalDebt ? stakedAmount - totalDebt : BigInt(0);
        const availableEth = ethers.formatEther(availableWei);
        
        stakingInfo.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
                <div style="background: rgba(74, 222, 128, 0.1); border: 1px solid #4ade80; border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 0.85rem; color: #4ade80; margin-bottom: 0.5rem;">Total Staked</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #fff;">${parseFloat(stakedEth).toFixed(4)} ETH</div>
                </div>
                <div style="background: rgba(251, 146, 60, 0.1); border: 1px solid #fb923c; border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 0.85rem; color: #fb923c; margin-bottom: 0.5rem;">Locked for Debt</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #fff;">${parseFloat(debtEth).toFixed(4)} ETH</div>
                </div>
                <div style="background: rgba(96, 165, 250, 0.1); border: 1px solid #60a5fa; border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 0.85rem; color: #60a5fa; margin-bottom: 0.5rem;">Available to Unstake</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #fff;">${parseFloat(availableEth).toFixed(4)} ETH</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading staking data:', error);
        stakingInfo.innerHTML = '<p style="color: #ff6b6b;">Error loading staking data</p>';
    }
}

// ========== LOAD ALL SYSTEM LOANS (ADMIN) ==========
// ========== LOAD ALL SYSTEM LOANS (ADMIN) ==========
async function loadAllSystemLoans() {
    const loansDiv = document.getElementById('loansList');
    if (!loansDiv) {
        console.log('Loans list container not found');
        return;
    }
    
    try {
        loansDiv.innerHTML = '<p class="loading-text">Loading all system loans...</p>';
        
        const allUsers = await contract.getAllUsers();
        let allLoans = [];
        
        // Loop through each user and fetch their loans
        for (const userAddr of allUsers) {
            try {
                const userLoans = await contract.getUserLoans(userAddr);
                for (const loan of userLoans) {
                    allLoans.push({
                        ...loan,
                        borrowerAddress: userAddr
                    });
                }
            } catch (err) {
                console.error('Error fetching loans for user:', userAddr, err);
            }
        }
        
        if (allLoans.length === 0) {
            loansDiv.innerHTML = '<p style="color: #888;">No loans in the system</p>';
            return;
        }
        
        // Sort by loanId (descending - newest first)
        allLoans.sort((a, b) => Number(b.loanId) - Number(a.loanId));
        
        let html = '<div style="display: grid; gap: 1rem;">';
        
        for (const loan of allLoans) {
            const principalEth = ethers.formatEther(loan.principal);
            const repaidEth = ethers.formatEther(loan.repaidAmount);
            const totalEth = ethers.formatEther(loan.totalAmountToRepay);
            const remainingEth = ethers.formatEther(loan.totalAmountToRepay - loan.repaidAmount);
            
            const issueDate = new Date(Number(loan.issueDate) * 1000).toLocaleDateString();
            const dueDate = new Date(Number(loan.dueDate) * 1000).toLocaleDateString();
            
            let statusBadge = '';
            let statusColor = '';
            
            if (loan.isRepaid) {
                statusBadge = '<span class="badge status-repaid">REPAID</span>';
                statusColor = '#4ade80';
            } else if (loan.isDefaulted) {
                statusBadge = '<span class="badge status-defaulted">DEFAULTED</span>';
                statusColor = '#ff6b6b';
            } else if (loan.isLate) {
                statusBadge = '<span class="badge status-late">LATE</span>';
                statusColor = '#ffa500';
            } else {
                statusBadge = '<span class="badge status-active">ACTIVE</span>';
                statusColor = '#60a5fa';
            }
            
            const progress = loan.totalAmountToRepay > 0 ? (Number(loan.repaidAmount) / Number(loan.totalAmountToRepay)) * 100 : 0;
            const borrowerName = await getUserName(loan.borrowerAddress);
            
            html += `
                <div class="loan-card" style="background: rgba(255,255,255,0.03); border: 1px solid #333; border-radius: 8px; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <div>
                            <h4 style="margin: 0; color: #fff;">Loan #${loan.loanId.toString()}</h4>
                            <p style="color: #888; font-size: 0.85rem; margin: 0.25rem 0;">${borrowerName} (${formatAddress(loan.borrowerAddress)})</p>
                        </div>
                        ${statusBadge}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
                        <div>
                            <div style="font-size: 0.75rem; color: #888;">Principal</div>
                            <div style="font-weight: bold;">${principalEth} ETH</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #888;">Interest Rate</div>
                            <div style="font-weight: bold;">${loan.interestRate.toString()}%</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #888;">Issue Date</div>
                            <div>${issueDate}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #888;">Due Date</div>
                            <div>${dueDate}</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                            <span>Repaid: ${repaidEth} / ${totalEth} ETH</span>
                            <span>${progress.toFixed(1)}%</span>
                        </div>
                        <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: ${statusColor}; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                    ${!loan.isRepaid && !loan.isDefaulted ? `
                        <div style="color: #ccc; font-size: 0.9rem;">
                            Remaining: <strong style="color: ${statusColor};">${remainingEth} ETH</strong>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        loansDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading all system loans:', error);
        loansDiv.innerHTML = '<p style="color: #ff6b6b;">Error loading system loans</p>';
    }
}

async function loadAdminHistory() {
    // Load rejection history or other admin events
    console.log('Loading admin history...');
}

// ========== UI DISPLAY FUNCTIONS ==========
function displayUserLoans(loans) {
    const loansDiv = document.getElementById('loansList');
    if (!loansDiv) return;
    
    if (loans.length === 0) {
        loansDiv.innerHTML = '<p style="color: #888;">No loans found</p>';
        return;
    }
    
    let html = '<div style="display: grid; gap: 1rem;">';
    
    for (const loan of loans) {
        const principalEth = ethers.formatEther(loan.principal);
        const repaidEth = ethers.formatEther(loan.repaidAmount);
        const totalEth = ethers.formatEther(loan.totalAmountToRepay);
        const remainingEth = ethers.formatEther(loan.totalAmountToRepay - loan.repaidAmount);
        
        const issueDate = new Date(Number(loan.issueDate) * 1000).toLocaleDateString();
        const dueDate = new Date(Number(loan.dueDate) * 1000).toLocaleDateString();
        
        let statusBadge = '';
        let statusColor = '';
        
        if (loan.isRepaid) {
            statusBadge = '<span class="badge" style="background: #4ade80; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">REPAID</span>';
            statusColor = '#4ade80';
        } else if (loan.isDefaulted) {
            statusBadge = '<span class="badge" style="background: #ff6b6b; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">DEFAULTED</span>';
            statusColor = '#ff6b6b';
        } else if (loan.isLate) {
            statusBadge = '<span class="badge" style="background: #ffa500; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">LATE</span>';
            statusColor = '#ffa500';
        } else {
            statusBadge = '<span class="badge" style="background: #60a5fa; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">ACTIVE</span>';
            statusColor = '#60a5fa';
        }
        
        const progress = loan.totalAmountToRepay > 0 ? (Number(loan.repaidAmount) / Number(loan.totalAmountToRepay)) * 100 : 0;
        
        html += `
            <div class="loan-card" style="background: rgba(255,255,255,0.03); border: 1px solid #333; border-radius: 8px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <h4 style="margin: 0; color: #fff;">Loan #${loan.loanId.toString()}</h4>
                    ${statusBadge}
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
                    <div>
                        <div style="font-size: 0.75rem; color: #888;">Principal</div>
                        <div style="font-weight: bold;">${principalEth} ETH</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #888;">Interest Rate</div>
                        <div style="font-weight: bold;">${loan.interestRate.toString()}%</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #888;">Issue Date</div>
                        <div>${issueDate}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #888;">Due Date</div>
                        <div>${dueDate}</div>
                    </div>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                        <span>Repaid: ${repaidEth} / ${totalEth} ETH</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                    <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${statusColor}; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                ${!loan.isRepaid && !loan.isDefaulted ? `
                    <div style="color: #ccc; font-size: 0.9rem;">
                        Remaining: <strong style="color: ${statusColor};">${remainingEth} ETH</strong>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    loansDiv.innerHTML = html;
}

function displayFinancialHistory(history) {
    const historyDiv = document.getElementById('financialHistory');
    if (!historyDiv) return;
    
    if (history.length === 0) {
        historyDiv.innerHTML = '<p style="color: #888;">No financial history</p>';
        return;
    }
    
    let html = '<div style="display: grid; gap: 0.75rem;">';
    
    for (const activity of history) {
        const timestamp = new Date(Number(activity.timestamp) * 1000).toLocaleString();
        const amountEth = activity.amount > 0 ? ethers.formatEther(activity.amount) : '0';
        
        let icon = '📝';
        let color = '#888';
        
        if (activity.activityType.includes('Loan')) {
            icon = '💰';
            color = '#60a5fa';
        } else if (activity.activityType.includes('Repayment')) {
            icon = '✅';
            color = '#4ade80';
        } else if (activity.activityType.includes('Default')) {
            icon = '❌';
            color = '#ff6b6b';
        } else if (activity.activityType.includes('Late')) {
            icon = '⏰';
            color = '#ffa500';
        } else if (activity.activityType.includes('Stake')) {
            icon = '🔒';
            color = '#a78bfa';
        }
        
        html += `
            <div style="background: rgba(255,255,255,0.03); border-left: 3px solid ${color}; border-radius: 4px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span style="font-size: 1.2rem;">${icon}</span>
                        <strong style="color: ${color};">${activity.activityType}</strong>
                    </div>
                    <div style="color: #ccc; font-size: 0.9rem;">${activity.description}</div>
                    <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">${timestamp}</div>
                </div>
                ${activity.amount > 0 ? `<div style="font-weight: bold; color: ${color}; font-size: 1.1rem;">${amountEth} ETH</div>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    historyDiv.innerHTML = html;
}

function displayScoreBreakdown(breakdown) {
    const breakdownDiv = document.getElementById('scoreBreakdown');
    if (!breakdownDiv) return;
    
    const items = [
        { label: 'Payment History', score: breakdown.paymentHistoryScore, max: 350, color: '#4ade80' },
        { label: 'Repayment Consistency', score: breakdown.repaymentConsistencyScore, max: 250, color: '#60a5fa' },
        { label: 'Loan Activity', score: breakdown.loanActivityScore, max: 200, color: '#a78bfa' },
        { label: 'Collateral', score: breakdown.collateralScore, max: 50, color: '#fbbf24' },
        { label: 'External Score', score: breakdown.oracleScore, max: 50, color: '#f472b6' }
    ];
    
    let html = '<div style="display: grid; gap: 0.75rem;">';
    
    for (const item of items) {
        const percentage = (item.score / item.max) * 100;
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span style="color: #ccc; font-size: 0.9rem;">${item.label}</span>
                    <span style="color: ${item.color}; font-weight: bold;">${item.score} / ${item.max}</span>
                </div>
                <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: ${item.color}; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    breakdownDiv.innerHTML = html;
}

function displayUserProfile(userInfo) {
    const profileDiv = document.getElementById('userProfile');
    if (!profileDiv) return;
    
    const stakedEth = ethers.formatEther(userInfo.stakedAmount);
    const repaymentsEth = ethers.formatEther(userInfo.totalRepayments);
    
    profileDiv.innerHTML = `
        <div style="display: grid; gap: 0.75rem;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Name</div>
                    <div style="font-weight: bold;">${userInfo.name}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Status</div>
                    <div style="font-weight: bold; color: ${userInfo.isActive ? '#4ade80' : '#ff6b6b'};">${userInfo.isActive ? 'Active' : 'Inactive'}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Total Loans</div>
                    <div style="font-weight: bold; color: #60a5fa;">${userInfo.totalLoans.toString()}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Repaid Loans</div>
                    <div style="font-weight: bold; color: #4ade80;">${userInfo.repaidLoansCount.toString()}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Total Repayments</div>
                    <div style="font-weight: bold; color: #4ade80;">${repaymentsEth} ETH</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Defaults</div>
                    <div style="font-weight: bold; color: #ff6b6b;">${userInfo.defaults.toString()}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Staked Collateral</div>
                    <div style="font-weight: bold; color: #a78bfa;">${parseFloat(stakedEth).toFixed(4)} ETH</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px;">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">Loan Requests</div>
                    <div style="font-weight: bold; color: #fbbf24;">${userInfo.totalRequests.toString()}</div>
                </div>
            </div>
        </div>
    `;
}

function getScoreDescription(score) {
    if (score >= 750) return 'Excellent - Highly trustworthy borrower';
    if (score >= 700) return 'Very Good - Reliable payment history';
    if (score >= 650) return 'Good - Decent creditworthiness';
    if (score >= 600) return 'Fair - Some credit concerns';
    if (score >= 550) return 'Poor - High risk borrower';
    return 'Very Poor - Significant credit issues';
}

async function getUserName(address) {
    try {
        const basic = await contract.getUserInfoBasic(address);
        return basic[0];
    } catch {
        return 'Unknown User';
    }
}

window.copyAddress = function(address) {
    // Modern clipboard API with fallback for http:// localhost
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address)
            .then(() => {
                alert('Address copied to clipboard!');
            })
            .catch(err => {
                console.warn('Clipboard API failed, using fallback:', err);
                copyAddressFallback(address);
            });
    } else {
        copyAddressFallback(address);
    }
}

function copyAddressFallback(address) {
    // Create temporary textarea for fallback copy
    const textarea = document.createElement('textarea');
    textarea.value = address;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert('Address copied to clipboard!');
        } else {
            alert('Failed to copy address. Please copy manually: ' + address);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Failed to copy address. Please copy manually: ' + address);
    } finally {
        document.body.removeChild(textarea);
    }
}

