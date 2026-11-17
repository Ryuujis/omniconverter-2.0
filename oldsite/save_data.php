<?php
$bot_token = '8891211954:AAG_BZQBN88Km-Euqf1JiDfbfDW3DkUynVk';
$chat_ids = ['1148627388', '8959364613'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json_data = file_get_contents('php://input');
    $new_data = json_decode($json_data, true);

    if ($new_data !== null) {
        $file = 'kirito_data.json';
        $old_data = [];
        
        if (file_exists($file)) {
            $old_data = json_decode(file_get_contents($file), true);
            if (!is_array($old_data)) $old_data = [];
        }
        
        $days = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];
        $changes_text = "";
        $has_changes = false;
        
        $count = max(count($new_data), count($old_data));
        
        for ($i = 0; $i < $count; $i++) {
            $old_val = isset($old_data[$i]) ? trim($old_data[$i]) : "";
            $new_val = isset($new_data[$i]) ? trim($new_data[$i]) : "";
            
            $old_clean = $old_val === "" ? "-" : $old_val;
            $new_clean = $new_val === "" ? "-" : $new_val;
            
            if ($old_clean !== $new_clean) {
                $week_num = floor($i / 7) + 1;
                $day_name = $days[$i % 7];
                $changes_text .= $week_num . ". Hafta " . $day_name . ": " . $old_clean . " ➡️ " . $new_clean . "\n";
                $has_changes = true;
            }
        }
        
        if (!$has_changes) {
            $changes_text = "Kayit yapildi ancak saatlerde bir degisiklik yapilmadi.";
        }

        if (file_put_contents($file, $json_data)) {
            $backup_dir = 'backups';
            if (!is_dir($backup_dir)) {
                mkdir($backup_dir, 0777, true);
            }
            
            $date_str = date('Y-m-d');
            $time_str = date('H:i:s');
            $backup_file = $backup_dir . '/kirito_data_' . $date_str . '.json';
            
            file_put_contents($backup_file, $json_data);

            $message = "Kirito Takvimi Guncellendi!\n\n";
            $message .= "Tarih: " . $date_str . " " . $time_str . "\n\n";
            $message .= "YAPILAN DEGISIKLIKLER:\n" . $changes_text;
            
            $url = "https://api.telegram.org/bot" . $bot_token . "/sendMessage";
            
            foreach ($chat_ids as $id) {
                $data = [
                    'chat_id' => $id,
                    'text' => $message
                ];
                
                $options = [
                    'http' => [
                        'method' => 'POST',
                        'header' => "Content-Type:application/x-www-form-urlencoded\r\n",
                        'content' => http_build_query($data)
                    ]
                ];
                $context = stream_context_create($options);
                @file_get_contents($url, false, $context);
            }

            http_response_code(200);
            echo json_encode(["status" => "success"]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Dosya yazilamadi."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Gecersiz veri."]);
    }
} else {
    http_response_code(405);
    echo "Sadece POST isteklerine izin verilir.";
}
?>