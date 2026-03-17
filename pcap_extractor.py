import pandas as pd
import numpy as np
from scapy.all import PcapReader, IP, TCP, UDP
from feature_config import EXPECTED_FEATURES

class FlowState:
    def __init__(self, first_packet, timestamp, src_ip, dst_ip, src_port, dst_port):
        self.src_ip = src_ip
        self.dst_ip = dst_ip
        self.src_port = src_port
        self.dst_port = dst_port
        
        self.start_time = timestamp
        self.last_time = timestamp
        
        self.fwd_packets = 0
        self.fwd_bytes = 0
        self.bwd_packets = 0
        self.bwd_bytes = 0
        self.fwd_header_len = 0
        self.bwd_header_len = 0
        
        self.fwd_packet_lengths = []
        self.bwd_packet_lengths = []
        self.fwd_iats = []
        self.bwd_iats = []
        self.flow_iats = []
        
        self.fin_count = 0
        self.psh_count = 0
        self.ack_count = 0
        
        self.init_win_fwd = -1
        self.init_win_bwd = -1

    def add_packet(self, packet, timestamp, direction, length, header_len, flags, win_size):
        current_iat = timestamp - self.last_time
        if self.fwd_packets + self.bwd_packets > 0: 
            self.flow_iats.append(current_iat)
            
        if direction == "fwd":
            if self.fwd_packets > 0:
                self.fwd_iats.append(current_iat)
            if self.fwd_packets == 0 and win_size is not None:
                self.init_win_fwd = win_size
                
            self.fwd_packets += 1
            self.fwd_bytes += length
            self.fwd_header_len += header_len
            self.fwd_packet_lengths.append(length)
        else:
            if self.bwd_packets > 0:
                self.bwd_iats.append(current_iat)
            if self.bwd_packets == 0 and win_size is not None:
                self.init_win_bwd = win_size
                
            self.bwd_packets += 1
            self.bwd_bytes += length
            self.bwd_header_len += header_len
            self.bwd_packet_lengths.append(length)

        if flags:
            if 'F' in flags: self.fin_count += 1
            if 'P' in flags: self.psh_count += 1
            if 'A' in flags: self.ack_count += 1

        self.last_time = timestamp

    def export_features(self):
        duration = self.last_time - self.start_time
        duration_sec = duration if duration > 0 else 0.000001 
        
        all_lengths = self.fwd_packet_lengths + self.bwd_packet_lengths
        
        # Safely handle empty lists for numpy calculations
        safe_max = lambda x: np.max(x) if x else 0
        safe_min = lambda x: np.min(x) if x else 0
        safe_mean = lambda x: np.mean(x) if x else 0
        safe_std = lambda x: np.std(x) if len(x) > 1 else 0
        safe_sum = lambda x: np.sum(x) if x else 0
        
        return {
            'Destination Port': self.dst_port,
            'Flow Duration': duration * 1000000, 
            'Total Fwd Packets': self.fwd_packets,
            'Total Length of Fwd Packets': self.fwd_bytes,
            
            'Fwd Packet Length Max': safe_max(self.fwd_packet_lengths),
            'Fwd Packet Length Min': safe_min(self.fwd_packet_lengths),
            'Fwd Packet Length Mean': safe_mean(self.fwd_packet_lengths),
            'Fwd Packet Length Std': safe_std(self.fwd_packet_lengths),

            'Bwd Packet Length Max': safe_max(self.bwd_packet_lengths),
            'Bwd Packet Length Min': safe_min(self.bwd_packet_lengths),
            'Bwd Packet Length Mean': safe_mean(self.bwd_packet_lengths),
            'Bwd Packet Length Std': safe_std(self.bwd_packet_lengths),

            'Flow Bytes/s': (self.fwd_bytes + self.bwd_bytes) / duration_sec,
            'Flow Packets/s': (self.fwd_packets + self.bwd_packets) / duration_sec,
            'Fwd Packets/s': self.fwd_packets / duration_sec,
            'Bwd Packets/s': self.bwd_packets / duration_sec,

            'Flow IAT Mean': safe_mean(self.flow_iats) * 1000000,
            'Flow IAT Std': safe_std(self.flow_iats) * 1000000,
            'Flow IAT Max': safe_max(self.flow_iats) * 1000000,
            'Flow IAT Min': safe_min(self.flow_iats) * 1000000,

            'Fwd IAT Total': safe_sum(self.fwd_iats) * 1000000,
            'Fwd IAT Mean': safe_mean(self.fwd_iats) * 1000000,
            'Fwd IAT Std': safe_std(self.fwd_iats) * 1000000,
            'Fwd IAT Max': safe_max(self.fwd_iats) * 1000000,
            'Fwd IAT Min': safe_min(self.fwd_iats) * 1000000,
 
            'Bwd IAT Total': safe_sum(self.bwd_iats) * 1000000,
            'Bwd IAT Mean': safe_mean(self.bwd_iats) * 1000000,
            'Bwd IAT Std': safe_std(self.bwd_iats) * 1000000,
            'Bwd IAT Max': safe_max(self.bwd_iats) * 1000000,
            'Bwd IAT Min': safe_min(self.bwd_iats) * 1000000,
   
            'Fwd Header Length': self.fwd_header_len,
            'Bwd Header Length': self.bwd_header_len,

            'Min Packet Length': safe_min(all_lengths),
            'Max Packet Length': safe_max(all_lengths),
            'Packet Length Mean': safe_mean(all_lengths),
            'Packet Length Std': safe_std(all_lengths),
            'Packet Length Variance': np.var(all_lengths) if len(all_lengths) > 1 else 0,
            'Average Packet Size': safe_mean(all_lengths),

            'FIN Flag Count': self.fin_count,
            'PSH Flag Count': self.psh_count,
            'ACK Flag Count': self.ack_count,
            'Init_Win_bytes_forward': self.init_win_fwd,
            'Init_Win_bytes_backward': self.init_win_bwd,

            'Source IP': self.src_ip,
            'Destination IP': self.dst_ip
        }

def extract_from_pcap(pcap_path):
    flows = {}
    
    try:
        with PcapReader(pcap_path) as pcap_reader:
            for packet in pcap_reader:
                if IP in packet and (TCP in packet or UDP in packet):
                    src_ip = packet[IP].src
                    dst_ip = packet[IP].dst
                    src_port = packet.sport
                    dst_port = packet.dport
                    protocol = packet[IP].proto
                    
                    # Flow Hashing (Bi-directional)
                    fwd_hash = (src_ip, dst_ip, src_port, dst_port, protocol)
                    bwd_hash = (dst_ip, src_ip, dst_port, src_port, protocol)
                    
                    timestamp = float(packet.time)
                    length = len(packet[TCP].payload) if TCP in packet else len(packet[UDP].payload)
                    header_len = packet[IP].ihl * 4 + (packet[TCP].dataofs * 4 if TCP in packet else 8)
                    flags = packet[TCP].flags if TCP in packet else None
                    win_size = packet[TCP].window if TCP in packet else None

                    if fwd_hash in flows:
                        flows[fwd_hash].add_packet(packet, timestamp, "fwd", length, header_len, flags, win_size)
                    elif bwd_hash in flows:
                        flows[bwd_hash].add_packet(packet, timestamp, "bwd", length, header_len, flags, win_size)
                    else:
                        flows[fwd_hash] = FlowState(packet, timestamp, src_ip, dst_ip, src_port, dst_port)
                        flows[fwd_hash].add_packet(packet, timestamp, "fwd", length, header_len, flags, win_size)

        flow_records = [flow.export_features() for flow in flows.values()]
        df = pd.DataFrame(flow_records)

        missing_features = [feat for feat in EXPECTED_FEATURES if feat not in df.columns]
        

        for feature in missing_features:
            df[feature] = np.nan

        df = df.replace([np.inf, -np.inf], np.nan)
        
        warning_msg = None
        if missing_features:
            warning_msg = f"Partial Extraction: Missing {len(missing_features)} features. XGBoost is using sparsity-aware prediction."

        return {
            "status": "success",
            "warning": warning_msg,
            "missing_features": missing_features,
            "data": df
        }
        
    except Exception as e:
        return {"status": "error", "message": f"PCAP reading failed: {str(e)}", "missing_features": []}