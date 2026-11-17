<?php
$bot_token = '8891211954:AAG_BZQBN88Km-Euqf1JiDfbfDW3DkUynVk';
$chat_ids = ['1148627388', '8959364613'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json_data = file_get_contents('php://input');
    $payload = json_decode($json_data, true);

    if ($payload !== null && isset($payload['inputs'])) {
        $inputs = $payload['inputs'];
        $totals = $payload['totals'];
        $grandTotal = $payload['grandTotal'];

        $days = ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];
        $message = "📊 KIRITO TAKVIMI GUNCEL DURUM\n\n";

        for ($w = 0; $w < 4; $w++) {
            $message .= ($w + 1) . ". Hafta:\n";
            $week_parts = [];
            for ($d = 0; $d < 7; $d++) {
                $val = trim($inputs[$w * 7 + $d]);
                if ($val === "") $val = "-";
                $week_parts[] = $days[$d] . ": " . $val;
            }
            $message .= implode(" | ", $week_parts) . "\n";
            $message .= "🔹 Toplam: " . $totals[$w] . " Saat\n\n";
        }

        $message .= "🏆 AYLIK GENEL TOPLAM: " . $grandTotal . " Saat";

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
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Gecersiz veri."]);
    }
} else {
    http_response_code(405);
    echo "Sadece POST isteklerine izin verilir.";
}
?>