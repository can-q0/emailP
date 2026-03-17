export interface TourStep {
  id: string;
  target: string; // data-tour attribute value
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
}

export const DASHBOARD_TOUR: TourStep[] = [
  {
    id: "search-bar",
    target: "search-bar",
    title: "Hasta Arama",
    description:
      "Arama çubuğuna hasta adını yazarak lab sonuçlarını bulabilirsiniz. Sistem e-postalarınızdaki lab raporlarını tarayarak eşleşen sonuçları getirir.",
    placement: "bottom",
  },
  {
    id: "quick-actions",
    target: "quick-actions",
    title: "Hızlı Erişim",
    description:
      "Raporları görüntüleyin, birden fazla hasta için toplu rapor oluşturun veya gelişmiş arama yapın.",
    placement: "top",
  },
  {
    id: "recent-reports",
    target: "recent-reports",
    title: "Son Raporlar",
    description:
      "Oluşturduğunuz raporlar burada listelenir. Tıklayarak detaylı AI analizine ulaşabilirsiniz.",
    placement: "top",
  },
  {
    id: "nav-links",
    target: "nav-links",
    title: "Navigasyon",
    description:
      "Dashboard, Arama, Hastalar ve Raporlar sayfalarına menüden ulaşabilirsiniz.",
    placement: "bottom",
  },
];

export const REPORT_TOUR: TourStep[] = [
  {
    id: "ai-summary",
    target: "ai-summary",
    title: "AI Analizi",
    description:
      "Yapay zeka, kan değerlerinizi analiz ederek önemli bulguları özetler. Her rapor için kişiselleştirilmiş değerlendirme sunar.",
    placement: "bottom",
  },
  {
    id: "blood-chart",
    target: "blood-chart",
    title: "Kan Değerleri Grafiği",
    description:
      "Kan değerlerinin zaman içindeki değişimini grafiksel olarak görebilirsiniz. Referans aralıkları gri bantla gösterilir.",
    placement: "top",
  },
  {
    id: "attention-points",
    target: "attention-points",
    title: "Dikkat Noktaları",
    description:
      "Referans aralık dışında olan değerler otomatik olarak işaretlenir. Yüksek, orta ve düşük önem derecelerine göre sınıflandırılır.",
    placement: "top",
  },
  {
    id: "export-actions",
    target: "export-actions",
    title: "Dışa Aktarım",
    description:
      "Raporlarınızı PDF veya Excel formatında indirebilir, e-posta ile hastaya veya meslektaşınıza gönderebilirsiniz.",
    placement: "bottom",
  },
];
