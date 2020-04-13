-- generated on https://dbdiagram.io/d/5e568adaef8c251a06189cb3
-- foreign keys fixed  manually 

CREATE TABLE `games` (
  `gms_id` int PRIMARY KEY AUTO_INCREMENT,
  `gms_name` varchar(255),
  `gms_status` varchar(255),
  `gms_vote_style` varchar(255),
  `gms_created_at` timestamp,
  `gms_gru_id` int
);

CREATE TABLE `game_players` (
  `gpl_gms_id` int,
  `gpl_slack_id` varchar(255),
  `gpl_name` varchar(255),
  `gpl_status` varchar(255),
  `gpl_leader` boolean,
  `gpl_drawn` boolean,
  `gpl_number_of_messages` int,
  PRIMARY KEY (`gpl_gms_id`, `gpl_slack_id`)
);

CREATE TABLE `game_polls` (
  `gpo_gms_id` int,
  `gpo_number` int,
  `gpo_slack_message_id` varchar(255),
  `gpo_title` varchar(255),
  `gpo_status` varchar(255),
  PRIMARY KEY (`gpo_gms_id`, `gpo_number`)
);

CREATE TABLE `game_votes` (
  `gvo_gpo_gms_id` int,
  `gvo_gpo_number` int,
  `gvo_gpl_gms_id` int,
  `gvo_gpl_slack_id` varchar(255),
  `gvo_voted_on_gpl_gms_id` int,
  `gvo_voted_on_gpl_slack_id` varchar(255),
  `gvo_voted_at` timestamp,
  PRIMARY KEY (`gvo_gpo_gms_id`, `gvo_gpo_number`, `gvo_gpl_gms_id`, `gvo_gpl_slack_id`)
);

CREATE TABLE `game_rules` (
  `gru_id` int PRIMARY KEY AUTO_INCREMENT,
  `gru_name` varchar(255),
  `gru_rules` text
);

ALTER TABLE `games` ADD FOREIGN KEY (`gms_gru_id`) REFERENCES `game_rules` (`gru_id`);

ALTER TABLE `game_players` ADD FOREIGN KEY (`gpl_gms_id`) REFERENCES `games` (`gms_id`);

ALTER TABLE `game_polls` ADD FOREIGN KEY (`gpo_gms_id`) REFERENCES `games` (`gms_id`);

ALTER TABLE `game_votes` ADD FOREIGN KEY (`gvo_gpo_gms_id`, `gvo_gpo_number`) REFERENCES `game_polls` (`gpo_gms_id`, `gpo_number`);

ALTER TABLE `game_votes` ADD FOREIGN KEY (`gvo_gpl_gms_id`, `gvo_gpl_slack_id`) REFERENCES `game_players` (`gpl_gms_id`, `gpl_slack_id`);

ALTER TABLE `game_votes` ADD FOREIGN KEY (`gvo_voted_on_gpl_gms_id`, `gvo_voted_on_gpl_slack_id`) REFERENCES `game_players` (`gpl_gms_id`, `gpl_slack_id`);


