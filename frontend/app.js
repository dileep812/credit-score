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
    
    try {
        showStatus("Recording repayment...", "loading");
        
        const amountInWei = ethers.parseEther(amount);
        const tx = await contract.recordRepayment(parseInt(loanId), amountInWei);
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
    // ===== 1. CREATE LOAN (Admin Only) =====
    const createLoanForm = document.getElementById('createLoanForm');
    if (createLoanForm) {
        createLoanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAdmin()) {
                showStatus("Admin only function", "error");
                return;
            }
            
            if (!contract) {
                showStatus("Contract not initialized", "error");
                return;
            }
            
            const borrowerAddress = document.getElementById('borrowerAddress').value.trim();
            const principal = document.getElementById('principal').value.trim();
            const interestRate = document.getElementById('interestRate').value.trim();
            const durationDays = document.getElementById('durationDays').value.trim();
            
            if (!borrowerAddress || !principal || !interestRate || !durationDays) {
                showStatus("Please fill in all fields", "error");
                return;
            }
            
            if (!ethers.isAddress(borrowerAddress)) {
                showStatus("Invalid borrower address", "error");
                return;
            }
            
            try {
                showStatus("Creating loan on blockchain...", "loading");
                
                const principalInWei = ethers.parseEther(principal);
                const tx = await contract.createLoan(
                    borrowerAddress,
                    principalInWei,
                    parseInt(interestRate),
                    parseInt(durationDays)
                );
                const receipt = await tx.wait();
                
                showStatus(`✅ Loan created! TX: ${receipt.hash}`, "success");
                createLoanForm.reset();
                
                setTimeout(() => {
                    loadUserData();
                }, 2000);
            } catch (error) {
                console.error("Loan creation error:", error);
                showStatus(`Error: ${error.message || error}`, "error");
            }
        });
    }

    // ===== 2. RECORD DEFAULT (Admin Only) =====
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAdminForms();
});

