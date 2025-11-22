// Main Application Logic

// Register User
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        showStatus("Please connect your wallet first", "error");
        return;
    }
    
    if (!contract) {
        showStatus("Contract not initialized", "error");
        return;
    }
    
    const name = document.getElementById('userName').value.trim();
    
    if (!name) {
        showStatus("Please enter your name", "error");
        return;
    }
    
    try {
        showStatus("Registering user...", "loading");
        
        const tx = await contract.registerUser(name);
        const receipt = await tx.wait();
        
        showStatus(`✅ Registration successful! TX: ${receipt.hash}`, "success");
        document.getElementById('userName').value = '';
        
        setTimeout(() => {
            loadUserData();
        }, 2000);
    } catch (error) {
        console.error("Error:", error);
        showStatus(`Error: ${error.message || error}`, "error");
    }
});

// Record Loan Repayment (User)
document.getElementById('repaymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        showStatus("Please connect your wallet first", "error");
        return;
    }
    
    if (!contract) {
        showStatus("Contract not initialized", "error");
        return;
    }
    
    const loanId = document.getElementById('loanId').value.trim();
    const amount = document.getElementById('repaymentAmount').value.trim();
    
    if (!loanId || !amount) {
        showStatus("Please fill in all fields", "error");
        return;
    }
    
    // Strict validation: amount must be positive
    if (parseFloat(amount) <= 0) {
        showStatus("Repayment amount must be a positive value", "error");
        return;
    }
    
    try {
        showStatus("Recording repayment...", "loading");
        
        // Send ETH with the transaction using { value: ... }
        const amountInWei = ethers.parseEther(amount);
        const tx = await contract.recordRepayment(parseInt(loanId), { value: amountInWei });
        const receipt = await tx.wait();
        
        showStatus(`✅ Repayment recorded! TX: ${receipt.hash}`, "success");
        document.getElementById('loanId').value = '';
        document.getElementById('repaymentAmount').value = '';
        
        setTimeout(() => {
            loadUserData();
        }, 2000);
    } catch (error) {
        console.error("Error:", error);
        showStatus(`Error: ${error.message || error}`, "error");
    }
});

// Request Loan (User)
document.getElementById('requestLoanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        showStatus("Please connect your wallet first", "error");
        return;
    }
    
    if (!contract) {
        showStatus("Contract not initialized", "error");
        return;
    }
    
    const amount = document.getElementById('requestAmount').value.trim();
    const interestRate = document.getElementById('requestInterestRate').value.trim();
    const durationDays = document.getElementById('requestDurationDays').value.trim();
    const reason = document.getElementById('requestReason').value.trim();
    
    if (!amount || !interestRate || !durationDays || !reason) {
        showStatus("Please fill in all fields", "error");
        return;
    }
    
    // Strict validation: values must be positive
    if (parseFloat(amount) <= 0 || parseFloat(interestRate) <= 0 || parseInt(durationDays) <= 0) {
        showStatus("Amount, interest rate, and duration must be positive values", "error");
        return;
    }
    
    try {
        showStatus("Submitting loan request...", "loading");
        
        const amountInWei = ethers.parseEther(amount);
        const tx = await contract.requestLoan(
            amountInWei,
            parseInt(interestRate),
            parseInt(durationDays),
            reason
        );
        const receipt = await tx.wait();
        
        showStatus(`✅ Loan request submitted! TX: ${receipt.hash}`, "success");
        document.getElementById('requestLoanForm').reset();
        
        setTimeout(() => {
            loadUserData();
        }, 2000);
    } catch (error) {
        console.error("Loan request error:", error);
        showStatus(`Error: ${error.message || error}`, "error");
    }
});

// Refresh Credit Score
if (document.getElementById('refreshScore')) {
    document.getElementById('refreshScore').addEventListener('click', async () => {
        if (!userAddress) return;
        
        try {
            showStatus("Refreshing credit score...", "loading");
            loadUserData();
            showStatus("Credit score updated", "success");
        } catch (error) {
            showStatus(`Error: ${error.message}`, "error");
        }
    });
}

// Override showStatus to target specific form's status message
window.showStatus = function(message, type) {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    
    const statusDiv = activeTab.querySelector('.status-message');
    
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message ' + type;
        statusDiv.style.display = 'block';
    }
};

// ========== ADMIN FUNCTIONS ==========

function initAdminForms() {
    // ===== RECORD DEFAULT (Admin Only) =====
    const recordDefaultForm = document.getElementById('recordDefaultForm');
    if (recordDefaultForm) {
        recordDefaultForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAdmin()) {
                showStatus("Admin only function", "error");
                return;
            }
            
            if (!contract) {
                showStatus("Contract not initialized", "error");
                return;
            }
            
            const loanId = document.getElementById('defaultLoanId').value.trim();
            
            if (!loanId || loanId === "0") {
                showStatus("Please enter valid loan ID", "error");
                return;
            }
            
            try {
                showStatus("Recording default on blockchain...", "loading");
                
                const tx = await contract.recordDefault(parseInt(loanId));
                const receipt = await tx.wait();
                
                showStatus(`✅ Default recorded for Loan #${loanId}! TX: ${receipt.hash}`, "success");
                recordDefaultForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                }, 2000);
            } catch (error) {
                console.error("Default recording error:", error);
                showStatus(`Error: ${error.message || error}`, "error");
            }
        });
    }
    
    // ===== RECORD LATE PAYMENT (Admin Only) =====
    const recordLatePaymentForm = document.getElementById('recordLatePaymentForm');
    if (recordLatePaymentForm) {
        recordLatePaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAdmin()) {
                showStatus("Admin only function", "error");
                return;
            }
            
            if (!contract) {
                showStatus("Contract not initialized", "error");
                return;
            }
            
            const loanId = document.getElementById('lateLoanId').value.trim();
            
            if (!loanId || loanId === "0") {
                showStatus("Please enter valid loan ID", "error");
                return;
            }
            
            try {
                showStatus("Recording late payment on blockchain...", "loading");
                
                const tx = await contract.recordLatePayment(parseInt(loanId));
                const receipt = await tx.wait();
                
                showStatus(`✅ Late payment recorded for Loan #${loanId}! TX: ${receipt.hash}`, "success");
                recordLatePaymentForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                }, 2000);
            } catch (error) {
                console.error("Late payment recording error:", error);
                showStatus(`Error: ${error.message || error}`, "error");
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAdminForms();
    initCollateralForms();
    initOracleForm();
});

// ========== USER COLLATERAL (STAKING) FORMS ==========
function initCollateralForms() {
    const stakeForm = document.getElementById('stakeForm');
    if (stakeForm) {
        stakeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!userAddress) { showStatus('Connect wallet first', 'error'); return; }
            if (!contract) { showStatus('Contract not initialized', 'error'); return; }
            const amt = document.getElementById('stakeAmount').value.trim();
            if (!amt || parseFloat(amt) <= 0) { 
                showStatus('Stake amount must be a positive value', 'error'); 
                return; 
            }
            try {
                showStatus('Staking ETH...', 'loading');
                const wei = ethers.parseEther(amt);
                const tx = await contract.stake({ value: wei });
                const receipt = await tx.wait();
                showStatus(`✅ Staked ${amt} ETH (TX: ${receipt.hash})`, 'success');
                stakeForm.reset();
                setTimeout(() => { loadUserData(); loadStakingData(); }, 1500);
            } catch (err) {
                console.error(err);
                showStatus(`Error: ${err.message || err}`, 'error');
            }
        });
    }
    const unstakeForm = document.getElementById('unstakeForm');
    if (unstakeForm) {
        unstakeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!userAddress) { showStatus('Connect wallet first', 'error'); return; }
            if (!contract) { showStatus('Contract not initialized', 'error'); return; }
            const amt = document.getElementById('unstakeAmount').value.trim();
            if (!amt || parseFloat(amt) <= 0) { 
                showStatus('Unstake amount must be a positive value', 'error'); 
                return; 
            }
            try {
                showStatus('Unstaking ETH...', 'loading');
                const wei = ethers.parseEther(amt);
                const tx = await contract.unstake(wei);
                const receipt = await tx.wait();
                showStatus(`✅ Unstaked ${amt} ETH (TX: ${receipt.hash})`, 'success');
                unstakeForm.reset();
                setTimeout(() => { loadUserData(); loadStakingData(); }, 1500);
            } catch (err) {
                console.error(err);
                showStatus(`Error: ${err.message || err}`, 'error');
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
        if (!isAdmin()) { showStatus('Admin only function', 'error'); return; }
        if (!contract) { showStatus('Contract not initialized', 'error'); return; }
        const userAddr = document.getElementById('oracleUserAddress').value.trim();
        const scoreStr = document.getElementById('oracleScore').value.trim();
        if (!userAddr || !ethers.isAddress(userAddr)) { showStatus('Invalid user address', 'error'); return; }
        if (!scoreStr) { showStatus('Enter score', 'error'); return; }
        const score = parseInt(scoreStr);
        if (score < 0 || score > 50) { showStatus('Score must be between 0 and 50', 'error'); return; }
        try {
            showStatus('Updating external score...', 'loading');
            const tx = await contract.updateExternalScore(userAddr, score);
            const receipt = await tx.wait();
            showStatus(`✅ External score updated (TX: ${receipt.hash})`, 'success');
            oracleForm.reset();
            setTimeout(() => { loadUserData(); }, 1500);
        } catch (err) {
            console.error(err);
            showStatus(`Error: ${err.message || err}`, 'error');
        }
    });
}

