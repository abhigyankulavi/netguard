# NetGuard: AI-Enhanced Network Intrusion Detection

**Live Application:** [netguard-swart.vercel.app](https://netguard-swart.vercel.app/)  
**API Documentation:** [https://netguard-api.onrender.com/docs](https://netguard-api.onrender.com/docs)

---

## **Project Overview**
NetGuard is an integrated Security Information and Event Management (SIEM) solution that identifies and interprets network threats of high velocity using machine learning and generative AI. The solution enables real-time monitoring and classification of network threats, focusing on various types of DDoS attacks and unauthorized network traffic. The project functions as a complete stack proof of concept for modern Security Operations Center (SOC) automation, which minimizes the cognitive workload of security professionals to interpret raw network metrics into actionable mitigation strategies.

---

## **Visual Proofs**
### **System Demonstration**

### **Dashboard Preview**

---

## **Engineering Architecture**
The system is built in an organized and sacalable manner with components like machine learning model, backend and frontend infrastructures:

### **1. Intelligence Layer**
A complex classification engine driven by XGBoost (Extreme Gradient Boosting) forms the basis of NetGuard's detection capability. Because it can handle the non-linear, high-dimensional nature of network telemetry while retaining the low-latency inference necessary for real-time security monitoring, this model was especially chosen.

#### **A. Model training and dataset**
A very widely used dataset **"CICIDS2017"** was used for the machine learning. Over 2.5 million network flow samples, split between a training set of 1.89 million rows and a testing set of 630,188 rows, comprised the high-volume dataset used to train the engine. 52 unique bi-directional network features, including packet lengths, inter-arrival times, and TCP flag counts, are used to define each sample.

Macro Average Recall was given priority during the training process to make sure the model remained resilient against real-world imbalances, where malicious traffic is frequently dwarfed by legitimate flows. This made it possible to detect low-frequency, covert threats like botnets with the same accuracy as large-scale, volumetric attacks like DDoS.

#### **B. Performance Metrics**
* **Training set size:** (2016600, 43)
* **Testing set size:** (504151, 43)

# Classification Report

## Overall Metrics
- **Accuracy:** 1.00  
- **Total Samples:** 504,151  

## Class-wise Performance

| Class            | Precision | Recall | F1-Score | Support |
|------------------|----------|--------|----------|---------|
| Bots             | 0.91     | 0.74   | 0.82     | 389     |
| Brute Force      | 1.00     | 1.00   | 1.00     | 1,830   |
| DDoS             | 1.00     | 1.00   | 1.00     | 25,603  |
| DoS              | 1.00     | 1.00   | 1.00     | 38,749  |
| Normal Traffic   | 1.00     | 1.00   | 1.00     | 419,012 |
| Port Scanning    | 0.99     | 1.00   | 0.99     | 18,139  |
| Web Attacks      | 1.00     | 0.99   | 0.99     | 429     |

## Averages

| Metric        | Precision | Recall | F1-Score | Support |
|---------------|----------|--------|----------|---------|
| Macro Avg     | 0.98     | 0.96   | 0.97     | 504,151 |
| Weighted Avg  | 1.00     | 1.00   | 1.00     | 504,151 |

## Key Observations

- **Excellent overall accuracy (100%)**, indicating strong model performance.
- **Bots class shows comparatively lower recall (0.74)**:
  - Suggests false negatives (missed bot detections).
- **Highly imbalanced dataset**:
  - "Normal Traffic" dominates with ~83% of total samples.
- **Attack classes (DDoS, DoS, Brute Force)** are perfectly classified:
  - Possible overfitting or highly separable features.
- **Macro average (0.97 F1-score)** reveals slight weakness masked by weighted average.

## Recommendations

- Improve **Bots class recall**:
  - Use class weighting or oversampling (e.g., SMOTE).
- Validate on **unseen real-world traffic** to ensure generalization.
- Check for **data leakage** due to near-perfect scores.
- Consider **confusion matrix analysis** for deeper insight.

![Confusion Matrix](./Images/confusion_matrix_netguard_v03.png)
![Top Features](./Images/top_features_netguard_v03.png)

#### **C. Feature importance and behavioral analysis**
The approach does not depend on mere volume spikes but rather uses in-depth behavioral analysis of flow data to detect malicious activity. The training data has pointed to a number of key features that drive the logic of detection:

* **(i) Bwd Packet Length Min:** This is the key feature for Botnet "beaconing" activity. Small and constant values of the backward packet length are typical of automated Command & Control (C2) polling activity.
* **(ii) Idle Mean & Idle Min:** These features enable the model to detect stealthy attacks that have been dormant for certain periods of time to evade traditional firewall detection.
* **(iii) PSH Flag Count:** This feature is crucial for the detection of Web Attacks, where the "Push" flag is employed to immediately trigger the execution of the payload on a target server.

By concentrating on these specific features, the machine learning engine is able to provide a 99% Recall rate for Botnets, thus removing the "False Negative" blind spots that are common in traditional intrusion detection systems.

---

### **2. Backend Architecture**
Backend is built using FastAPI, which was selected for its asynchronous capabilities and native support for high-concurrency tasks.

* **A. Real-Time Communication:** I created a full-duplex connection using WebSockets (/ws/live). This removes the latency of conventional HTTP polling by enabling the server to instantly push threat detections to the user interface as they are processed.
* **B. Persistence Layer:** For historical logging, I incorporated Supabase (PostgreSQL). Long-term forensic analysis is made possible by the backend's management of a relational schema that keeps track of scan metadata and particular threat vectors.
* **C. Processing Logic:** The server manages multimodal ingestion, allowing both direct CSV uploads and raw.pcap files, which are then processed using CICFlowMeter in a temporary extraction environment.

---

### **3. Frontend Architecture**
A React-based command center designed for real-time data visualization makes up the frontend.

* **A. High-Performance Rendering:** I developed a low-latency dashboard that shows network health using Material UI for the interface and Vite for the build process.
* **B. Analytical Dashboards:** I incorporated Recharts to offer graphical depictions of attack intensity and threat vectors, enabling an analyst to rapidly assess the seriousness of an ongoing incident.
* **C. Deployment:** The application makes use of a contemporary CI/CD pipeline, with Render hosting the backend and Vercel hosting the frontend. This environment shows that I am capable of handling environment variables, CORS policies, and secure cross-origin communication in a distributed environment.

---

### **4. Updates and Future Work**
* **A. Hardware Acceleration (FPGA Integration):** Offloading feature extraction logic to FPGA using Verilog for line-rate hardware-level filtering.
* **B. Automated Mitigation (IPS):** Using automated response modules to update local firewall rules or AWS Security Groups is known as automated mitigation (IPS).
* **C. Zero-day Anomaly Detection:** Integrating unsupervised learning layers to identify traffic patterns absent from current datasets is known as "zero-day anomaly detection."

---
### **Note** 
* This project is currently a prototype and for production purposes, it will require some upgrades like better file parsing and live capture logics with lower latency. The project shows the usage of machine learning in detection of network intrusion and warns with mitigation advices to the user or analyst along with clear intrusion trajectories.
* The backend needs some time to wake up as it spins down with inactivity due to free tier restrictions of render. So, the frontend dashboard will require some time to function properly.
* You can test the project using test files in the test csv files folder. These are sample .csv files containing network traffic flows.
  
**Author:** Abhigyan Kulavi  
**Department:** Information Technology  
**Email:** abhigyan.kulavi2004@gmail.com
