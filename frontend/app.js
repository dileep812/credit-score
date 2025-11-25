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
    
    if (!loanId || !amount) {
        displayStatus('repaymentStatus', "Please fill in all fields", "error");
        return;
    }
    
    // Strict validation: amount must be positive
    if (parseFloat(amount) <= 0) {
        displayStatus('repaymentStatus', "Repayment amount must be a positive value", "error");
        return;
    }
    
    try {
        displayStatus('repaymentStatus', "Recording repayment...", "loading");
        
        // Send ETH with the transaction using { value: ... }
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
    
    if (!amount || !interestRate || !durationDays || !reason) {
        displayStatus('requestLoanStatus', "Please fill in all fields", "error");
        return;
    }
    
    // Strict validation: values must be positive
    if (parseFloat(amount) <= 0 || parseFloat(interestRate) <= 0 || parseInt(durationDays) <= 0) {
        displayStatus('requestLoanStatus', "Amount, interest rate, and duration must be positive values", "error");
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
            
            if (!loanId || loanId === "0") {
                displayStatus('recordDefaultStatus', "Please enter valid loan ID", "error");
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
            
            if (!loanId || loanId === "0") {
                displayStatus('recordLatePaymentStatus', "Please enter valid loan ID", "error");
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
            
            if (!amt || parseFloat(amt) <= 0) {
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
            
            if (!amt || parseFloat(amt) <= 0) {
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
        
        if (!userAddr || !ethers.isAddress(userAddr)) {
            displayStatus('oracleUpdateStatus', 'Invalid user address', 'error');
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

