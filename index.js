const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

const LOG_CHANNEL_ID = '1568339962057855238';
const TARGET_CHANNEL_ID = '1567720528179896340';
const ROLE_TO_ADD = '1568059867963461752';

const cooldowns = new Map();
const COOLDOWN_TIME = 60 * 1000;

const EMOJI_1 = '<:white_td3_h1t:1568104271021478040>';
const EMOJI_2 = '<:af_whitehangloose:1568104580552851508>';

const TARGET_ITEMS = [
    { id: '1331682045197287575', label: 'Opção 1' },
    { id: '1431823448891719816', label: 'Opção 2' },
    { id: '1425128178627772527', label: 'Opção 3' },
    { id: '805899928374607944', label: 'Opção 4' }
];

client.once('clientReady', async () => {
    console.log(`Logado como ${client.user.tag}`);

    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const updatedItems = await Promise.all(TARGET_ITEMS.map(async (item) => {
            try {
                const member = await guild.members.fetch(item.id);
                const name = member.nickname || member.user.globalName || member.user.username;
                return {
                    id: item.id,
                    label: name,
                    description: `Confirmar conhecimento de ${name}`
                };
            } catch {
                return {
                    id: item.id,
                    label: item.label,
                    description: `Confirmar conhecimento`
                };
            }
        }));

        const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        const existingMessage = messages.find(m => m.author.id === client.user.id);

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJI_1} Verificação de Acesso ${EMOJI_2}`)
            .setDescription(
                `Antes de liberar seu acesso completo ao servidor, precisamos que você escolha uma opção abaixo para confirmar sua participação ${EMOJI_1}.\n\n` +
                "Após realizar a seleção corretamente, seu acesso será liberado e você poderá aproveitar todas as funcionalidades do servidor!\n\n" +
                `**Faça tudo certinho para garantir sua liberação! ${EMOJI_2}**`
            )
            .setColor(0x2b2d31)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('painel_selecao')
            .setPlaceholder('Selecione um usuário na lista')
            .addOptions(
                updatedItems.map((item) => ({
                    label: item.label,
                    value: item.id,
                    description: item.description
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        if (existingMessage) {
            await existingMessage.edit({
                embeds: [embed],
                components: [row]
            });
        } else {
            const sentMessage = await channel.send({
                embeds: [embed],
                components: [row]
            });
            await sentMessage.pin();
        }
    } catch (error) {
        console.error('Erro ao configurar o painel:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'painel_selecao') {
        const userId = interaction.user.id;
        const now = Date.now();

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + COOLDOWN_TIME;
            if (now < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - now) / 1000);
                return await interaction.reply({
                    content: `Aguarde **${timeLeft} segundos** antes de enviar outra solicitação de verificação.`,
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), COOLDOWN_TIME);

        const selectedId = interaction.values[0];

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const verifyBtn = new ButtonBuilder()
                .setCustomId(`verify_${userId}`)
                .setLabel('Verificar')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(verifyBtn);

            await logChannel.send({
                content: `${EMOJI_1} O <@${userId}> marcou que conhece o <@${selectedId}> ${EMOJI_2}, deseja verificar?`,
                components: [row]
            });
        }

        await interaction.reply({ content: `Solicitação enviada para verificação! Por favor, aguarde ${EMOJI_2}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('verify_')) {
        const targetUserId = interaction.customId.replace('verify_', '');

        try {
            const member = await interaction.guild.members.fetch(targetUserId);
            await member.roles.add(ROLE_TO_ADD);

            const disabledBtn = new ButtonBuilder()
                .setCustomId('verified_done')
                .setLabel(`Verificado por ${interaction.user.username}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const updatedRow = new ActionRowBuilder().addComponents(disabledBtn);

            await interaction.update({
                content: `${interaction.message.content}\n\n✅ **Acesso liberado por <@${interaction.user.id}>** ${EMOJI_1}`,
                components: [updatedRow]
            });
        } catch (error) {
            console.error('Erro ao adicionar cargo:', error);
            await interaction.reply({ content: 'Ocorreu um erro ao tentar adicionar o cargo ao usuário.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);