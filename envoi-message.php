<?php
/**
 * Traitement du formulaire de contact — fiducia-ia.com
 * Envoie le message à contact@fiducia-ia.com puis redirige vers /merci.
 * Aucune donnée n'est stockée sur le serveur.
 */

declare(strict_types=1);

const DESTINATAIRE = 'contact@fiducia-ia.com';
const EXPEDITEUR   = 'site@fiducia-ia.com';

function refuser(string $code): never {
    header('Location: /contact?erreur=' . $code, true, 303);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    refuser('methode');
}

// Piège à robots : champ masqué en CSS, jamais rempli par un humain.
if (trim($_POST['societe_web'] ?? '') !== '') {
    header('Location: /merci', true, 303);
    exit;
}

$nom     = trim($_POST['nom'] ?? '');
$contact = trim($_POST['contact'] ?? '');
$message = trim($_POST['message'] ?? '');
$page    = trim($_POST['page'] ?? '');

if ($nom === '' || $contact === '' || $message === '') {
    refuser('champs');
}
if (mb_strlen($nom) > 120 || mb_strlen($contact) > 160 || mb_strlen($message) > 5000) {
    refuser('longueur');
}
// Neutralise toute tentative d'injection d'en-tête via les champs repris dans le mail.
if (preg_match('/[\r\n]/', $nom . $contact)) {
    refuser('format');
}

$estEmail = (bool) filter_var($contact, FILTER_VALIDATE_EMAIL);

$sujet = 'Demande depuis le site — ' . $nom;
$corps = "Nouveau message depuis fiducia-ia.com\n\n"
       . "Nom       : {$nom}\n"
       . "Contact   : {$contact}\n"
       . "Page      : " . ($page !== '' ? $page : 'non précisée') . "\n"
       . "Date      : " . date('d/m/Y H:i') . "\n\n"
       . "Message :\n{$message}\n";

$entetes = [
    'From'         => 'Site Fiducia IA <' . EXPEDITEUR . '>',
    'Content-Type' => 'text/plain; charset=UTF-8',
];
if ($estEmail) {
    $entetes['Reply-To'] = $contact;
}

$envoye = mail(
    DESTINATAIRE,
    '=?UTF-8?B?' . base64_encode($sujet) . '?=',
    $corps,
    $entetes
);

header('Location: ' . ($envoye ? '/merci' : '/contact?erreur=envoi'), true, 303);
exit;
