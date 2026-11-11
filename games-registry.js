// Zentrale Liste aller Spiele. Neue Spiele hier eintragen – Startseite und Rangliste rendern daraus.
// id = Wert der Spalte `spiel` in der Datenbank.
window.SPIELE = [
  { id: 'schach', name: 'Schach', icon: '♚', href: 'schach.html',
    info: 'Zu zweit, gegen KI oder online', online: true, status: 'fertig' },
  { id: 'dame', name: 'Dame', icon: '⛀', href: 'dame.html',
    info: 'Deutsche Regeln mit Schlagzwang', online: true, status: 'fertig' },
  { id: 'muehle', name: 'Mühle', icon: '⬡', href: 'muehle.html',
    info: 'Setzen, ziehen, springen', online: true, status: 'fertig' },
  { id: 'vier', name: 'Vier gewinnt', icon: '●', href: 'vier.html',
    info: 'Vier in einer Reihe gewinnt', online: true, status: 'fertig' }
];
