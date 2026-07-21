<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MerLo - Canlı İletişim</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-[#1e1f22] text-gray-200 font-sans h-screen overflow-hidden select-none flex items-center justify-center">

    <!-- GİRİŞ SAYFASI PANELİ -->
    <div id="loginPage" class="hidden bg-[#313338] w-full max-w-[780px] rounded-md p-8 shadow-2xl flex relative z-50">
        <div class="absolute top-8 left-8 flex items-center gap-2 text-indigo-400 font-black text-2xl tracking-wider">
            <i class="fa-solid fa-comments text-2xl text-indigo-500"></i> MerLo
        </div>
        <div class="w-full md:w-[60%] flex flex-col justify-center mt-8">
            <h2 class="text-2xl font-bold text-white mb-1">Tekrar hoş geldin!</h2>
            <p class="text-sm text-[#b5bac1] mb-5">Seni tekrar gördüğümüze çok sevindik!</p>
            <form id="loginForm" class="flex flex-col gap-4">
                <div>
                    <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">E-posta <span class="text-red-400">*</span></label>
                    <input id="loginEmail" type="email" required class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
                </div>
                <div>
                    <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">Şifre <span class="text-red-400">*</span></label>
                    <input id="loginPassword" type="password" required class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
                </div>
                <button type="submit" class="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-3 rounded mt-2">Giriş Yap</button>
                <p class="text-xs text-[#949ba4] mt-1">Bir hesaba mı ihtiyacın var? <button type="button" id="btnGoToRegister" class="text-[#00a8fc] hover:underline bg-transparent font-medium">Kaydol</button></p>
            </form>
        </div>
        <div class="hidden md:flex w-[40%] flex-col items-center justify-center border-l border-[#3f4147] pl-8 mt-8">
            <div class="bg-white p-3 rounded shadow-lg">
                <div class="w-36 h-36 bg-[#1e1f22] rounded flex flex-col items-center justify-center text-white p-2">
                    <i class="fa-solid fa-qrcode text-5xl mb-1 text-[#5865f2]"></i>
                    <span class="text-[10px] uppercase font-bold text-gray-400 tracking-widest">MERLO AUTH</span>
                </div>
            </div>
            <h3 class="text-white font-bold text-lg mt-4 text-center">QR Kodu ile hızlı bağlan</h3>
            <p class="text-xs text-[#b5bac1] text-center mt-2 px-2">Anında giriş yapmak için bu kodu <b>MerLo Mobil</b> uygulaması ile tara.</p>
        </div>
    </div>

    <!-- KAYIT SAYFASI PANELİ -->
    <div id="registerPage" class="hidden bg-[#313338] w-full max-w-[480px] rounded-md p-8 shadow-2xl flex-col relative z-50">
        <h2 class="text-2xl font-bold text-white text-center mb-6">Bir hesap oluştur</h2>
        <form id="registerForm" class="flex flex-col gap-4 w-full">
            <div>
                <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">E-posta <span class="text-red-400">*</span></label>
                <input id="regEmail" type="email" required class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
            </div>
            <div>
                <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">Kullanıcı Adı <span class="text-red-400">*</span></label>
                <input id="regUsername" type="text" required class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
            </div>
            <div>
                <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">Şifre <span class="text-red-400">*</span></label>
                <input id="regPassword" type="password" required minlength="6" class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
            </div>
            <button type="submit" class="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-3 rounded mt-2">Hesap Oluştur</button>
            <p class="text-xs text-[#949ba4] mt-2">Zaten bir hesabın var mı? <button type="button" id="btnGoToLogin" class="text-[#00a8fc] hover:underline bg-transparent font-medium">Giriş yap</button></p>
        </form>
    </div>

    <!-- MAIN APP PANELİ (/) -->
    <div id="mainAppPage" class="hidden fixed inset-0 flex bg-[#313338] z-[100] overflow-hidden">

        <!-- Mobilde arka plan karartma (drawer açıkken) -->
        <div id="mobileBackdrop" class="hidden fixed inset-0 bg-black/60 z-30 md:hidden"></div>

        <!-- SOL PANEL: Sunucu Çubuğu + Kanallar (mobilde kaydırmalı drawer) -->
        <div id="leftPanel" class="flex fixed md:static inset-y-0 left-0 z-40 -translate-x-full md:translate-x-0 transition-transform duration-200 shrink-0">
            <!-- Sunucu Çubuğu -->
            <div class="w-18 bg-[#1e1f22] flex flex-col items-center py-3 gap-2 shrink-0 overflow-y-auto">
                <button id="btnHome" title="Arkadaşlar / DM" class="relative w-12 h-12 bg-[#5865f2] rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer shrink-0">
                    <i class="fa-solid fa-house text-lg"></i>
                    <span id="friendRequestBadge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full items-center justify-center">0</span>
                </button>
                <div class="w-8 h-[2px] bg-[#35363c] rounded my-1 shrink-0"></div>
                <div id="serverIconList" class="flex flex-col items-center gap-2"></div>
                <button id="btnAddServer" title="Sunucu oluştur / katıl" class="w-12 h-12 bg-[#2b2d31] rounded-3xl flex items-center justify-center text-emerald-500 hover:bg-emerald-600 hover:text-white hover:rounded-2xl transition-all cursor-pointer shrink-0">
                    <i class="fa-solid fa-plus text-lg"></i>
                </button>
            </div>

            <!-- Kanallar / Arkadaşlar Sol Bar -->
            <div class="w-60 bg-[#2b2d31] flex flex-col justify-between shrink-0">

                <!-- SUNUCU GÖRÜNÜMÜ: kanal listesi -->
                <div id="channelBarPanel" class="flex-1 overflow-y-auto">
                    <div class="h-12 border-b border-[#1f2023] flex items-center justify-between px-4 shrink-0">
                        <h1 id="serverName" class="font-bold text-white truncate">Bir sunucu seç</h1>
                        <div class="flex items-center gap-3 shrink-0">
                            <button id="btnManageRoles" title="Roller" class="text-gray-400 hover:text-white">
                                <i class="fa-solid fa-tag"></i>
                            </button>
                            <button id="btnServerInfo" title="Davet kodunu göster" class="text-gray-400 hover:text-white">
                                <i class="fa-solid fa-circle-info"></i>
                            </button>
                            <button id="btnCloseLeftPanel" class="md:hidden text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                    <div class="p-2">
                        <div class="flex items-center justify-between px-1 mt-2 mb-1">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Yazı Kanalları</span>
                            <button id="btnAddTextChannel" title="Kanal ekle" class="text-gray-400 hover:text-white text-xs"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <div class="flex flex-col gap-0.5" id="textChannelsContainer"></div>

                        <div class="flex items-center justify-between px-1 mt-4 mb-1">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Sesli Kanallar</span>
                            <button id="btnAddVoiceChannel" title="Kanal ekle" class="text-gray-400 hover:text-white text-xs"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <div class="flex flex-col gap-0.5" id="voiceChannelsContainer"></div>
                    </div>
                </div>

                <!-- DM GÖRÜNÜMÜ: arkadaşlar -->
                <div id="dmBarPanel" class="hidden flex-1 overflow-y-auto flex-col">
                    <div class="h-12 border-b border-[#1f2023] flex items-center justify-between px-4 shrink-0">
                        <h1 class="font-bold text-white truncate">Arkadaşlar</h1>
                        <button id="btnCloseLeftPanel2" class="md:hidden text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="p-3">
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Arkadaş Ekle</label>
                        <div class="flex gap-1.5">
                            <input id="addFriendInput" type="text" placeholder="kullanıcı adı" class="flex-1 min-w-0 bg-[#1e1f22] text-white text-sm p-2 rounded outline-none border border-transparent focus:border-[#5865f2]">
                            <button id="btnSendFriendRequest" class="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-medium px-2.5 rounded shrink-0">Ekle</button>
                        </div>
                        <p id="addFriendError" class="text-red-400 text-xs mt-1.5 hidden"></p>
                    </div>

                    <div id="friendRequestsSection" class="hidden px-3 mb-3">
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Bekleyen İstekler</label>
                        <div id="friendRequestsList" class="flex flex-col gap-1.5"></div>
                    </div>

                    <div class="px-3">
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Arkadaşlarım</label>
                        <div id="friendsList" class="flex flex-col gap-0.5"></div>
                    </div>
                </div>

                <div id="voiceStatusBar" class="hidden bg-[#1e1f22] px-3 py-2 flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <i class="fa-solid fa-volume-high text-emerald-500 shrink-0"></i>
                        <div class="overflow-hidden">
                            <div class="text-xs font-bold text-emerald-500 truncate">Sesli bağlı</div>
                            <div id="voiceStatusChannelName" class="text-[11px] text-gray-400 truncate">—</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button id="btnToggleMute" title="Sesi kapat/aç" class="w-7 h-7 rounded-full bg-[#2b2d31] hover:bg-[#35373c] flex items-center justify-center text-gray-200">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                        <button id="btnLeaveVoice" title="Sesli odadan ayrıl" class="w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white">
                            <i class="fa-solid fa-phone-slash text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="h-14 bg-[#232428] flex items-center justify-between px-2 shrink-0">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <div id="userAvatar" class="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0">?</div>
                        <span id="currentUserTitle" class="text-sm font-semibold text-white truncate">Yükleniyor...</span>
                    </div>
                    <button id="logoutBtn" class="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white shrink-0">Çıkış</button>
                </div>
            </div>
        </div>


        <!-- Chat Penceresi -->
        <div class="flex-1 flex flex-col bg-[#313338] min-w-0">
            <div class="h-12 border-b border-[#1f2023] flex items-center px-3 md:px-4 gap-2 shrink-0">
                <button id="btnOpenLeftPanel" class="md:hidden text-gray-300 hover:text-white shrink-0" title="Sunucular ve kanallar">
                    <i class="fa-solid fa-bars text-lg"></i>
                </button>
                <i class="fa-solid fa-hashtag text-gray-400"></i>
                <span id="activeChannelTitle" class="font-bold text-white truncate">kanal seç</span>
                <button id="btnOpenRightPanel" class="md:hidden text-gray-300 hover:text-white shrink-0 ml-auto" title="Üyeler">
                    <i class="fa-solid fa-users text-lg"></i>
                </button>
            </div>
            <div id="chatArea" class="flex-1 p-4 overflow-y-auto flex flex-col gap-3 text-sm"></div>
            <div id="typingIndicator" class="px-4 text-xs text-gray-400 italic h-[18px]"></div>
            <div class="p-4 pt-1 bg-[#313338] shrink-0 relative">
                <div id="mentionDropdown" class="hidden"></div>
                <form id="messageForm" class="bg-[#383a40] rounded-lg px-4 py-2.5 shadow-inner">
                    <input id="messageInput" type="text" autocomplete="off" placeholder="Mesajı buraya salla... (@ ile birini etiketle)" class="bg-transparent w-full text-sm text-gray-200 outline-none">
                </form>
            </div>
        </div>


        <!-- Aktif Üyeler Barı -->
        <div id="rightPanel" class="w-60 bg-[#2b2d31] shrink-0 overflow-y-auto fixed md:static inset-y-0 right-0 z-40 translate-x-full md:translate-x-0 transition-transform duration-200">
            <div class="h-12 border-b border-[#1f2023] flex items-center justify-between px-4 shrink-0">
                <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Üyeler</span>
                <button id="btnCloseRightPanel" class="md:hidden text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="memberList" class="p-2 flex flex-col gap-1"></div>
        </div>
    </div>

    <!-- MODAL: Sunucu Oluştur / Katıl -->
    <div id="serverModal" class="hidden fixed inset-0 bg-black/70 z-[200] items-center justify-center">
        <div class="bg-[#313338] w-full max-w-sm rounded-md p-6 relative">
            <button id="closeServerModal" class="absolute top-3 right-3 text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <h2 class="text-xl font-bold text-white text-center mb-4">Bir Sunucu Ekle</h2>

            <div class="mb-5">
                <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">Yeni sunucu oluştur</label>
                <div class="flex gap-2">
                    <input id="newServerName" type="text" placeholder="Sunucu adı" class="flex-1 bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
                    <button id="btnCreateServer" class="bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-medium px-3 rounded">Oluştur</button>
                </div>
            </div>

            <div class="border-t border-[#3f4147] pt-4">
                <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">Davet koduyla katıl</label>
                <div class="flex gap-2">
                    <input id="joinServerCode" type="text" placeholder="Davet kodu" class="flex-1 bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2]">
                    <button id="btnJoinServer" class="bg-[#2b2d31] hover:bg-[#3a3c42] text-white text-sm font-medium px-3 rounded">Katıl</button>
                </div>
            </div>
            <p id="serverModalError" class="text-red-400 text-xs mt-3 hidden"></p>
        </div>
    </div>

    <!-- MODAL: Kanal Oluştur -->
    <div id="channelModal" class="hidden fixed inset-0 bg-black/70 z-[200] items-center justify-center">
        <div class="bg-[#313338] w-full max-w-sm rounded-md p-6 relative">
            <button id="closeChannelModal" class="absolute top-3 right-3 text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <h2 id="channelModalTitle" class="text-xl font-bold text-white text-center mb-4">Kanal Oluştur</h2>
            <input id="newChannelName" type="text" placeholder="kanal-adı" class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2] mb-4">
            <button id="btnCreateChannel" class="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-2.5 rounded">Oluştur</button>
        </div>
    </div>

    <!-- MODAL: Roller -->
    <div id="rolesModal" class="hidden fixed inset-0 bg-black/70 z-[200] items-center justify-center">
        <div class="bg-[#313338] w-full max-w-sm rounded-md p-6 relative">
            <button id="closeRolesModal" class="absolute top-3 right-3 text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <h2 class="text-xl font-bold text-white text-center mb-4">Roller</h2>

            <div id="rolesList" class="flex flex-col gap-1.5 mb-4"></div>

            <div id="createRoleSection" class="hidden border-t border-[#3f4147] pt-4">
                <label class="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">Yeni Rol Oluştur</label>
                <input id="newRoleName" type="text" placeholder="Rol adı (örn: Moderatör)" class="w-full bg-[#1e1f22] text-white p-2.5 rounded outline-none border border-transparent focus:border-[#5865f2] mb-3">
                <div id="roleColorSwatches" class="flex items-center gap-2 mb-3"></div>
                <button id="btnCreateRole" class="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-2 rounded text-sm">Oluştur</button>
            </div>
        </div>
    </div>

    <!-- MODAL: Davet Kodu Göster -->
    <div id="inviteModal" class="hidden fixed inset-0 bg-black/70 z-[200] items-center justify-center">
        <div class="bg-[#313338] w-full max-w-sm rounded-md p-6 relative text-center">
            <button id="closeInviteModal" class="absolute top-3 right-3 text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <h2 class="text-xl font-bold text-white mb-2">Arkadaşlarını davet et</h2>
            <p class="text-sm text-[#b5bac1] mb-4">Bu kodu paylaş, herkes bu sunucuya katılsın</p>
            <div id="inviteCodeDisplay" class="bg-[#1e1f22] text-[#00a8fc] font-mono text-lg py-3 rounded select-text"></div>
            <div class="border-t border-[#3f4147] mt-5 pt-4">
                <button id="btnLeaveServer" class="hidden w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded">Sunucudan Ayrıl</button>
                <button id="btnDeleteServer" class="hidden w-full bg-red-800 hover:bg-red-900 text-white text-sm font-medium py-2 rounded">Sunucuyu Sil</button>
            </div>
        </div>
    </div>

    <script type="module" src="app.js"></script>
</body>
</html>
