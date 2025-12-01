// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CreditScore {
    
    // Structs
    struct User {
        string name;
        uint256 creditScore;
        uint256 totalLoans;
        uint256 totalRepayments;
        uint256 defaults;
        uint256 latePayments; 
        uint256 totalRequests; 
        uint256 repaidLoansCount; 
        uint256 lastUpdated;
        bool isActive;
    }
    
    struct Loan {
        uint256 loanId;
        address borrower;
        uint256 principal;
        uint256 interestRate;
        uint256 issueDate;
        uint256 dueDate;
        uint256 repaidAmount;
        uint256 totalAmountToRepay;
        bool isRepaid;
        bool isLate;      
        bool isDefaulted; 
    }
    
    struct FinancialActivity {
        string activityType;
        uint256 amount;
        string description;
        uint256 timestamp;
    }

    struct LoanRequest {
        uint256 requestId;
        address borrower;
        uint256 amount;
        uint256 interestRate;
        uint256 durationDays;
        string reason;
        bool isApproved;
        bool isActive;
    }
    
    address public admin;
    uint256 private loanCounter;
    uint256 private requestCounter;
    
    mapping(address => User) public users;
    mapping(address => Loan[]) public userLoans;
    mapping(address => FinancialActivity[]) public financialHistory;
    mapping(uint256 => address) public loanBorrower;
    mapping(address => bool) public registeredUsers;
    mapping(address => LoanRequest[]) public loanRequests;
    mapping(address => uint256) public stakes;
    mapping(address => uint256) public externalScores;
    
    address[] public userList;
    
    event UserRegistered(address indexed user, string name, uint256 timestamp);
    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interestRate, uint256 dueDate);
    event RepaymentRecorded(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 timestamp);
    event LatePaymentRecorded(uint256 indexed loanId, address indexed borrower, uint256 timestamp);
    event DefaultRecorded(uint256 indexed loanId, address indexed borrower, uint256 timestamp);
    event CreditScoreUpdated(address indexed user, uint256 newScore, uint256 timestamp);
    event LoanRequested(uint256 indexed requestId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 durationDays, string reason);
    event LoanApproved(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower);
    event LoanRejected(uint256 indexed requestId, address indexed borrower, string reason, uint256 timestamp);
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event ExternalScoreUpdated(address indexed user, uint256 score, uint256 timestamp);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    modifier onlyRegistered(address _user) {
        require(registeredUsers[_user], "User does not exist");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        loanCounter = 1;
        requestCounter = 1;
    }
    
    function registerUser(string memory _name) public {
        require(!registeredUsers[msg.sender], "User already registered");
        require(bytes(_name).length > 0, "No Name");
        
        users[msg.sender] = User({
            name: _name,
            creditScore: 100, 
            totalLoans: 0,
            totalRepayments: 0,
            defaults: 0,
            latePayments: 0,
            totalRequests: 0,
            repaidLoansCount: 0,
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        registeredUsers[msg.sender] = true;
        userList.push(msg.sender);
        
        financialHistory[msg.sender].push(FinancialActivity({
            activityType: "Registration",
            amount: 0,
            description: "User registered on platform",
            timestamp: block.timestamp
        }));
        
        emit UserRegistered(msg.sender, _name, block.timestamp);
    }
    
    function _createLoan(
        address _borrower,
        uint256 _principal,
        uint256 _interestRate,
        uint256 _durationDays
    ) internal {
        uint256 dueDate = block.timestamp + (_durationDays * 1 days);
        uint256 totalAmountToRepay = _principal + ((_principal * _interestRate) / 100);
        
        Loan memory newLoan = Loan({
            loanId: loanCounter,
            borrower: _borrower,
            principal: _principal,
            interestRate: _interestRate,
            issueDate: block.timestamp,
            dueDate: dueDate,
            repaidAmount: 0,
            totalAmountToRepay: totalAmountToRepay,
            isRepaid: false,
            isLate: false,
            isDefaulted: false
        });
        userLoans[_borrower].push(newLoan);
        loanBorrower[loanCounter] = _borrower;
        
        if (registeredUsers[_borrower]) {
            users[_borrower].totalLoans += 1;
            financialHistory[_borrower].push(FinancialActivity({
                activityType: "Loan Created",
                amount: _principal,
                description: string(abi.encodePacked("Loan #", uint2str(loanCounter), " created")),
                timestamp: block.timestamp
            }));
            updateCreditScore(_borrower);
        }
        emit LoanCreated(loanCounter, _borrower, _principal, _interestRate, dueDate);
        loanCounter += 1;
    }

    function requestLoan(
        uint256 _amount,
        uint256 _interestRate,
        uint256 _durationDays,
        string memory _reason
    ) public {
        require(registeredUsers[msg.sender], "Not registered");
        require(_amount > 0, "Amount must be > 0");
        
        LoanRequest memory lr = LoanRequest({
            requestId: requestCounter,
            borrower: msg.sender,
            amount: _amount,
            interestRate: _interestRate,
            durationDays: _durationDays,
            reason: _reason,
            isApproved: false,
            isActive: true
        });
        loanRequests[msg.sender].push(lr);
        
        users[msg.sender].totalRequests += 1;
        updateCreditScore(msg.sender);
        
        emit LoanRequested(requestCounter, msg.sender, _amount, _interestRate, _durationDays, _reason);
        requestCounter += 1;
    }

    function approveLoan(address _borrower, uint256 _requestIndex) public payable onlyAdmin {
        require(registeredUsers[_borrower], "Borrower not registered");
        require(_requestIndex < loanRequests[_borrower].length, "Invalid index");
        LoanRequest storage req = loanRequests[_borrower][_requestIndex];
        require(req.isActive, "Request inactive");
        require(!req.isApproved, "Already approved");
        require(msg.value == req.amount, "Must send exact loan amount");

        req.isApproved = true;
        req.isActive = false;

        payable(_borrower).transfer(msg.value);
        _createLoan(_borrower, req.amount, req.interestRate, req.durationDays);

        emit LoanApproved(req.requestId, loanCounter - 1, _borrower);
    }
    
    function rejectLoan(address _borrower, uint256 _requestIndex, string memory _reason) public onlyAdmin {
        require(registeredUsers[_borrower], "Borrower not registered");
        require(_requestIndex < loanRequests[_borrower].length, "Invalid index");
        LoanRequest storage req = loanRequests[_borrower][_requestIndex];
        require(req.isActive, "Request already processed");
        
        req.isActive = false;
        emit LoanRejected(req.requestId, _borrower, _reason, block.timestamp);
    }
    
    function recordRepayment(uint256 _loanId) public payable {
        require(msg.value > 0, "Amount > 0");
        
        address borrower = loanBorrower[_loanId];
        require(borrower != address(0), "Loan does not exist");
        require(msg.sender == borrower, "Only borrower can record repayment");
        
        Loan storage loan = userLoans[borrower][findLoanIndex(borrower, _loanId)];
        require(!loan.isRepaid, "Loan already repaid");
        
        uint256 remainingBalance = loan.totalAmountToRepay - loan.repaidAmount;
        require(msg.value <= remainingBalance, "Payment exceeds amount owed");
        
        loan.repaidAmount += msg.value;
        
        if (loan.repaidAmount == loan.totalAmountToRepay) {
            loan.isRepaid = true;
            if (registeredUsers[borrower]) {
                users[borrower].repaidLoansCount += 1;
            }
        }
        
        payable(admin).transfer(msg.value);
        
        if (registeredUsers[borrower]) {
            users[borrower].totalRepayments += msg.value;
            financialHistory[borrower].push(FinancialActivity({
                activityType: "Repayment",
                amount: msg.value,
                description: string(abi.encodePacked("Repayment for Loan #", uint2str(_loanId))),
                timestamp: block.timestamp
            }));
            
            updateCreditScore(borrower);
        }
        
        emit RepaymentRecorded(_loanId, borrower, msg.value, block.timestamp);
    }
    
    // Strict checks: Duration must be completed AND Loan must not be closed
    function recordLatePayment(uint256 _loanId) public onlyAdmin {
        address borrower = loanBorrower[_loanId];
        require(borrower != address(0), "Loan does not exist");
        
        Loan storage loan = userLoans[borrower][findLoanIndex(borrower, _loanId)];
        require(!loan.isRepaid, "Cannot mark late payment on closed loan");
        require(!loan.isLate, "Loan already marked as Late"); 
        require(!loan.isDefaulted, "Loan already defaulted");
        require(block.timestamp > loan.dueDate, "Cannot mark late before due date");
        
        loan.isLate = true; 
        
        if (registeredUsers[borrower]) {
            users[borrower].latePayments += 1; 
            
            financialHistory[borrower].push(FinancialActivity({
                activityType: "Late Payment",
                amount: loan.totalAmountToRepay - loan.repaidAmount,
                description: string(abi.encodePacked("Late Warning for Loan #", uint2str(_loanId))),
                timestamp: block.timestamp
            }));
            updateCreditScore(borrower);
        }
        emit LatePaymentRecorded(_loanId, borrower, block.timestamp);
    }
    
    // Strict checks: Must be Late first AND Duration must be completed
    function recordDefault(uint256 _loanId) public onlyAdmin {
        address borrower = loanBorrower[_loanId];
        require(borrower != address(0), "Loan does not exist");
        
        Loan storage loan = userLoans[borrower][findLoanIndex(borrower, _loanId)];
        require(!loan.isRepaid, "Cannot default on repaid loan");
        require(loan.isLate, "Loan must be marked as LATE before defaulting");
        require(!loan.isDefaulted, "Loan already defaulted");
        require(block.timestamp > loan.dueDate, "Cannot default before due date");
        
        loan.isDefaulted = true;
        
        if (registeredUsers[borrower]) {
            users[borrower].defaults += 1; 
            
            financialHistory[borrower].push(FinancialActivity({
                activityType: "Default",
                amount: loan.principal - loan.repaidAmount,
                description: string(abi.encodePacked("Default on Loan #", uint2str(_loanId))),
                timestamp: block.timestamp
            }));
            updateCreditScore(borrower);
        }
        
        emit DefaultRecorded(_loanId, borrower, block.timestamp);
    }
    
    function getCreditScore(address _user) public view returns (uint256) {
        if (!registeredUsers[_user]) return 0;
        return users[_user].creditScore;
    }
    
    function getCreditScoreBreakdown(address _user) public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        if (!registeredUsers[_user]) return (0, 0, 0, 0, 0, 0);
        
        User storage user = users[_user];
        uint256[6] memory scores; 

        int256 historyScore = 100; 
        
        historyScore += int256(user.repaidLoansCount * 30);
        historyScore -= int256(user.defaults * 100);
        historyScore -= int256(user.latePayments * 20);
        
        if (historyScore < 0) {
            scores[0] = 0;
        } else {
            scores[0] = uint256(historyScore);
        }
        if (scores[0] > 350) scores[0] = 350;

        scores[1] = user.repaidLoansCount * 25;
        if (scores[1] > 250) scores[1] = 250;

        scores[2] = user.totalLoans * 20;
        if (scores[2] > 200) scores[2] = 200;

        scores[3] = (stakes[_user] * 50) / 1 ether;
        if (scores[3] > 50) scores[3] = 50;
        
        scores[4] = externalScores[_user];
        if (scores[4] > 50) scores[4] = 50;
        
        uint256 total = scores[0] + scores[1] + scores[2] + scores[3] + scores[4];
        
        uint256 reqPenalty = user.totalRequests * 10;
        
        if (reqPenalty > total) {
            scores[5] = 0;
        } else {
            scores[5] = total - reqPenalty;
        }
        
        if (scores[5] > 900) scores[5] = 900;
        
        return (scores[0], scores[1], scores[2], scores[3], scores[4], scores[5]);
    }

    function getFinancialHistory(address _user) public view onlyRegistered(_user) returns (FinancialActivity[] memory) {
        return financialHistory[_user];
    }
    
    function getUserLoans(address _user) public view onlyRegistered(_user) returns (Loan[] memory) {
        return userLoans[_user];
    }
    
    function userExists(address _user) public view returns (bool) {
        return registeredUsers[_user];
    }
    
    function updateCreditScore(address _user) internal {
        if (!registeredUsers[_user]) return;
        
        User storage user = users[_user];
        (,,,, , uint256 newScore) = getCreditScoreBreakdown(_user);
        
        user.creditScore = newScore;
        user.lastUpdated = block.timestamp;
        
        emit CreditScoreUpdated(_user, newScore, block.timestamp);
    }
    
    function findLoanIndex(address _borrower, uint256 _loanId) internal view returns (uint256) {
        Loan[] storage loans = userLoans[_borrower];
        for (uint256 i = 0; i < loans.length; i++) {
            if (loans[i].loanId == _loanId) {
                return i;
            }
        }
        revert("Loan not found");
    }
    
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        return string(bstr);
    }
    
    function getAdmin() public view returns (address) { return admin; }
    
    function getUserInfoBasic(address _user) public view returns (string memory, uint256, bool, uint256, uint256) {
        require(registeredUsers[_user], "User does not exist");
        User storage user = users[_user];
        return (user.name, user.creditScore, user.isActive, user.lastUpdated, stakes[_user]);
    }

    function getUserInfoStats(address _user) public view returns (uint256, uint256, uint256, uint256, uint256) {
        require(registeredUsers[_user], "User does not exist");
        User storage user = users[_user];
        return (user.totalLoans, user.totalRepayments, user.defaults, user.totalRequests, user.repaidLoansCount);
    }
    
    function getLoanCount() public view returns (uint256) { return loanCounter - 1; }

    function getLoanRequests(address _user) public view returns (LoanRequest[] memory) {
        return loanRequests[_user];
    }
    
    function getAllUsers() public view returns (address[] memory) { return userList; }

    function calculateTotalDebt(address _user) public view returns (uint256) {
        Loan[] storage userLoanArray = userLoans[_user];
        uint256 totalDebt = 0;
        for (uint256 i = 0; i < userLoanArray.length; i++) {
            if (!userLoanArray[i].isRepaid) {
                totalDebt += (userLoanArray[i].totalAmountToRepay - userLoanArray[i].repaidAmount);
            }
        }
        return totalDebt;
    }
    
    function stake() public payable {
        require(msg.value > 0, "Must stake positive amount");
        require(registeredUsers[msg.sender], "Not registered");
        stakes[msg.sender] += msg.value;
        financialHistory[msg.sender].push(FinancialActivity("Stake", msg.value, "Staked ETH", block.timestamp));
        updateCreditScore(msg.sender);
        emit Staked(msg.sender, msg.value, block.timestamp);
    }
    
    function unstake(uint256 _amount) public {
        require(registeredUsers[msg.sender], "Not registered");
        require(stakes[msg.sender] >= _amount, "Insufficient stake");
        uint256 totalDebt = calculateTotalDebt(msg.sender);
        require((stakes[msg.sender] - _amount) >= totalDebt, "Funds locked for active debt");
        stakes[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
        financialHistory[msg.sender].push(FinancialActivity("Unstake", _amount, "Withdrew staked ETH", block.timestamp));
        updateCreditScore(msg.sender);
        emit Unstaked(msg.sender, _amount, block.timestamp);
    }
    
    function updateExternalScore(address _user, uint256 _score) public onlyAdmin {
        require(registeredUsers[_user], "Not registered");
        require(_score <= 50, "Max 50");
        externalScores[_user] = _score;
        updateCreditScore(_user);
        emit ExternalScoreUpdated(_user, _score, block.timestamp);
    }
}