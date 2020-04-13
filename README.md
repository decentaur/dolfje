# Dolfje een MNOT Weerwolf bot

Deze bot is geschreven om het weerwolven spel op de MNOT weerwolven slack te begeleiden.
Wij spelen het spel met een (of meerdere) verteller(s) die het spel leiden.
Speel een keer mee op https://mnot.nl/weerwolvenslack !

## Installatie handleiding

Dolfje is als klein project begonnen en beetje uit de hand gelopen.
Het ondersteund maar 1 spel en 1 Slack te tegelijkertijd, als je dus ook van Dolfje gebruik wilt maken zal je het zelf moeten hosten.
Hieronder een beknopt stappen plan.

### Maak een nieuwe Slack app

```
Op https://api.slack.com/apps kan je een nieuwe app aan maken, het makkelijkst is omdat direct in de Slack te doen waar je Dolfje wilt gebruiken
```

### Maak de database aan

```
De wwmnot.sql maakt de database aan zoals je hem nodig hebt. Dolfje gebruikt een MariaDB database.
Wil je een ander type database wilt gebruiken zal je zelf de code daar voor moeten aanpassen.
```

### Maak een .env file aan

```
In voorbeeld.env staat welke regels er in je .env file moeten komen te staan
```

### Installeer NodeJS

```
Installeer NodeJS en installeer de benodige packages.
```

### Draai index.js

```
Draai met NodeJS index.js (ik gebruik hiervoor de pm2 proces manager)
```

## Handleidng

De gebruikershandleiding kan je hier vinden:
https://1drv.ms/w/s!AjgzSBmd1PZUhcxdH5OCI-CUCAPDDg?e=qgeq05

## Credit

Dolfje is gemaakt door foaly met vertaalhulp van Maikel en testhulp van Thijs, Gerine, Ferry en deWiskeyNerd (aka deVerteller).
Je kunt ons vinden op onze weerwolf slack https://mnot.nl/weerwolvenslack
Heb je vragen, tips, opmeringen, suggesties of wil je iets anders over Dolfje kwijt mag je op die Slack altijd foaly DMen!
Wil je je dankbaarheid tonen, mag je altijd een kop thee voor me kopen ;) https://paypal.me/foaly
