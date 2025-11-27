import $ from 'jquery';
import { _CONFIG_ } from './config';
import type { VideoParseItem } from './config';
import { util } from './utils';

// 主逻辑模块
const superVip = (function () {

    /**
     * 基础消费者类，定义了脚本在页面上运行的核心逻辑和生命周期。
     */
    class BaseConsumer {
        /**
         * 解析流程的入口方法，按顺序执行各个生命周期钩子。
         */
        parse(): void {
            util.findTargetEle('body')
                .then((container) => this.preHandle(container)) // 1. 预处理
                .then((container) => this.generateElement(container as HTMLElement)) // 2. 生成 UI 元素
                .then((container) => this.bindEvent(container as HTMLElement)) // 3. 绑定事件
                .then((container) => this.autoPlay(container as HTMLElement)) // 4. 处理自动播放
                .then((container) => this.postHandle(container as HTMLElement)); // 5. 后处理
        }

        /**
         * 预处理钩子：在页面上执行一些清理操作，例如移除广告或遮罩层。
         * @param container 页面 body 元素
         */
        preHandle(container: Element): Promise<Element> {
            if (!_CONFIG_.currentPlayerNode) {
                return Promise.resolve(container);
            }
            // 根据配置隐藏页面上的指定元素
            _CONFIG_.currentPlayerNode.displayNodes.forEach((item: string) => {
                util.findTargetEle(item)
                    .then((obj) => (obj as HTMLElement).style.display = 'none')
                    .catch(e => console.warn("不存在元素", e));
            });
            return Promise.resolve(container);
        }

        /**
         * 生成 UI 元素钩子：向页面注入悬浮按钮和解析列表的 HTML 及 CSS。
         * @param container 页面 body 元素
         */
        generateElement(container: HTMLElement): Promise<HTMLElement> {
            // 注入 CSS 样式
            GM_addStyle(`
                /* 基础变量定义 */
                :root {
                    --vip-primary-color: #00aaff;
                    --vip-primary-hover: #33bbff;
                    --vip-bg-dark: rgba(30, 30, 30, 0.85);
                    --vip-bg-glass: rgba(40, 40, 40, 0.7);
                    --vip-border-color: rgba(255, 255, 255, 0.1);
                    --vip-text-main: #e0e0e0;
                    --vip-text-sub: #aaaaaa;
                    --vip-shadow-lg: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                    --vip-shadow-sm: 0 4px 6px rgba(0,0,0,0.1);
                    --vip-transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }

                /* VIP 悬浮按钮容器 */
                #${_CONFIG_.vipBoxId} {
                    cursor: pointer;
                    position: fixed;
                    top: 180px;
                    z-index: 999999;
                    text-align: center;
                    width: 48px;
                    height: 48px;
                    transition: var(--vip-transition);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }

                /* 贴边吸附效果 */
                #${_CONFIG_.vipBoxId}.snap-right { right: -24px; }
                #${_CONFIG_.vipBoxId}.snap-right:hover { right: 10px; }
                #${_CONFIG_.vipBoxId}.snap-left { left: -24px; }
                #${_CONFIG_.vipBoxId}.snap-left:hover { left: 10px; }

                /* 拖拽状态 */
                #${_CONFIG_.vipBoxId}.dragging {
                    transform: scale(1.1);
                    transition: none;
                }
                #${_CONFIG_.vipBoxId}.snap-right.dragging,
                #${_CONFIG_.vipBoxId}.snap-left.dragging {
                    width: 48px;
                    left: auto;
                    right: auto;
                }

                /* VIP 图标按钮 */
                #${_CONFIG_.vipBoxId} .vip_icon {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
                    border-radius: 50%;
                    box-shadow: var(--vip-shadow-sm);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 800;
                    color: #ffc107;
                    border: 1px solid var(--vip-border-color);
                    transition: var(--vip-transition);
                    backdrop-filter: blur(4px);
                    position: relative;
                    overflow: hidden;
                }

                /* 按钮微光效果 */
                #${_CONFIG_.vipBoxId} .vip_icon::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                    opacity: 0;
                    transform: scale(0.5);
                    transition: var(--vip-transition);
                }

                #${_CONFIG_.vipBoxId}:hover .vip_icon {
                    border-color: var(--vip-primary-color);
                    box-shadow: 0 0 20px rgba(0, 170, 255, 0.4);
                    transform: scale(1.05);
                    color: #fff;
                    background: linear-gradient(135deg, #00aaff 0%, #0077cc 100%);
                }
                
                #${_CONFIG_.vipBoxId}:hover .vip_icon::after {
                    opacity: 1;
                    transform: scale(1);
                }

                /* 贴边时的形状变化 */
                #${_CONFIG_.vipBoxId}.snap-right .vip_icon { border-radius: 24px 0 0 24px; margin-left: -12px; }
                #${_CONFIG_.vipBoxId}.snap-left .vip_icon { border-radius: 0 24px 24px 0; margin-right: -12px; }
                #${_CONFIG_.vipBoxId}:hover .vip_icon { border-radius: 50% !important; margin: 0 !important; }

                /* 解析列表菜单容器 - Glassmorphism */
                #${_CONFIG_.vipBoxId} .vip_list {
                    display: none;
                    position: absolute;
                    top: 0;
                    text-align: left;
                    background: var(--vip-bg-glass);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid var(--vip-border-color);
                    border-radius: 16px;
                    padding: 20px;
                    width: 380px;
                    max-height: 500px;
                    overflow-y: auto;
                    box-shadow: var(--vip-shadow-lg);
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                    transform-origin: top right;
                    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                /* 菜单显示状态 */
                #${_CONFIG_.vipBoxId}.show .vip_list {
                    display: block;
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }

                /* 菜单位置 */
                #${_CONFIG_.vipBoxId}.snap-right .vip_list { right: 60px; top: 0; transform-origin: top right; }
                #${_CONFIG_.vipBoxId}.snap-left .vip_list { left: 60px; top: 0; transform-origin: top left; }

                /* 标题样式 */
                #${_CONFIG_.vipBoxId} .vip_list h3 {
                    color: var(--vip-primary-color);
                    font-weight: 700;
                    font-size: 15px;
                    padding-bottom: 10px;
                    margin: 0 0 15px 0;
                    border-bottom: 1px solid var(--vip-border-color);
                    display: flex;
                    align-items: center;
                    letter-spacing: 0.5px;
                }
                #${_CONFIG_.vipBoxId} .vip_list h3::before {
                    content: '';
                    display: inline-block;
                    width: 4px;
                    height: 16px;
                    background: var(--vip-primary-color);
                    margin-right: 8px;
                    border-radius: 2px;
                }

                /* 列表网格布局 */
                #${_CONFIG_.vipBoxId} .vip_list ul {
                    padding: 0;
                    margin: 0 0 20px 0;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
                    gap: 10px;
                }

                /* 列表项样式 */
                #${_CONFIG_.vipBoxId} .vip_list li {
                    list-style: none;
                    border-radius: 8px;
                    font-size: 13px;
                    color: var(--vip-text-main);
                    text-align: center;
                    line-height: 32px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid transparent;
                    padding: 0 8px;
                    margin: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    user-select: none;
                }

                /* 列表项悬停与选中 */
                #${_CONFIG_.vipBoxId} .vip_list li:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    color: #fff;
                }
                #${_CONFIG_.vipBoxId} li.selected {
                    background: var(--vip-primary-color);
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(0, 170, 255, 0.4);
                    font-weight: 600;
                }

                /* 底部信息栏 */
                #${_CONFIG_.vipBoxId} .vip_list .info-box {
                    text-align: left;
                    color: var(--vip-text-sub);
                    font-size: 12px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                    line-height: 1.6;
                }
                #${_CONFIG_.vipBoxId} .vip_list .info-box b { color: var(--vip-primary-color); }

                /* 底部开关栏 */
                #${_CONFIG_.vipBoxId} .panel-footer {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid var(--vip-border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: var(--vip-text-main);
                    font-size: 13px;
                }

                /* 开关控件 */
                #${_CONFIG_.vipBoxId} .toggle-switch {
                    width: 44px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    position: relative;
                    cursor: pointer;
                    transition: background 0.3s ease;
                }
                #${_CONFIG_.vipBoxId} .toggle-switch.on { background: var(--vip-primary-color); }
                #${_CONFIG_.vipBoxId} .toggle-handle {
                    width: 20px;
                    height: 20px;
                    background: #fff;
                    border-radius: 50%;
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                #${_CONFIG_.vipBoxId} .toggle-switch.on .toggle-handle { left: 22px; }

                /* 滚动条美化 */
                #${_CONFIG_.vipBoxId} .vip_list::-webkit-scrollbar { width: 4px; }
                #${_CONFIG_.vipBoxId} .vip_list::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 2px;
                }
                #${_CONFIG_.vipBoxId} .vip_list::-webkit-scrollbar-track { background: transparent; }
            `);

            // 针对移动端优化样式
            if (_CONFIG_.isMobile) {
                GM_addStyle(`
                    #${_CONFIG_.vipBoxId} { top: 300px; }
                    #${_CONFIG_.vipBoxId} .vip_list { width: 300px; max-height: 60vh; }
                `);
            }

            // 根据解析源类型，生成不同的列表项
            let type_1_str = "";
            let type_2_str = "";
            let type_3_str = "";
            _CONFIG_.videoParseList.forEach((item, index) => {
                if (item.type.includes("1")) {
                    type_1_str += `<li class="nq-li" title="${item.name}1" data-index="${index}">${item.name}</li>`;
                }
                if (item.type.includes("2")) {
                    type_2_str += `<li class="tc-li" title="${item.name}" data-index="${index}">${item.name}</li>`;
                }
                if (item.type.includes("3")) {
                    type_3_str += `<li class="tc-li" title="${item.name}" data-index="${index}">${item.name}</li>`;
                }
            });

            // 读取自动播放设置
            let isAutoPlayOn = !!GM_getValue(_CONFIG_.autoPlayerKey, null);

            // 注入 HTML
            $(container).append(`
                <div id="${_CONFIG_.vipBoxId}">
                    <div class="vip_icon" title="点击展开解析列表">VIP</div>
                    <div class="vip_list">
                        <div>
                            <h3>内嵌播放</h3>
                            <ul>${type_1_str}</ul>
                        </div>
                        <div>
                            <h3>弹窗播放 (带选集)</h3>
                            <ul>${type_2_str}</ul>
                        </div>
                        <div>
                            <h3>弹窗播放 (纯净)</h3>
                            <ul>${type_3_str}</ul>
                        </div>
                        <div class="info-box">
                            <b>功能说明：</b>
                            <br>1. 自动解析仅支持内嵌播放源。
                            <br>2. 解析失败请尝试切换其他线路。
                            <br>3. 若网站已有会员，建议关闭自动解析。
                        </div>
                        <div class="panel-footer">
                            <span>自动解析当前线路</span>
                            <div class="toggle-switch ${isAutoPlayOn ? 'on' : ''}" id="vip_auto_toggle">
                                <div class="toggle-handle"></div>
                            </div>
                        </div>
                    </div>
                </div>`);

            // 恢复悬浮按钮上次的位置
            const savedTop = GM_getValue("vip_button_pos_top", null) as number | null;
            const savedSide = GM_getValue("vip_button_side", "right") as 'left' | 'right';
            const vipBox = $(`#${_CONFIG_.vipBoxId}`);

            if (savedTop !== null) {
                vipBox.css({ top: savedTop + 'px' });
            }
            vipBox.addClass(savedSide === 'left' ? 'snap-left' : 'snap-right');

            return Promise.resolve(container);
        }

        /**
         * 绑定事件钩子：为注入的 UI 元素绑定点击、拖拽等事件。
         * @param container 页面 body 元素
         */
        bindEvent(container: HTMLElement): Promise<HTMLElement> {
            const vipBox = $(`#${_CONFIG_.vipBoxId}`);
            let wasDragged = false;

            // VIP 图标点击事件，用于展开/收起解析列表
            vipBox.find(".vip_icon").on("click", (e) => {
                if (wasDragged) {
                    e.stopPropagation();
                    return;
                }
                e.stopPropagation();
                vipBox.toggleClass("show");
            });

            // 点击页面其他地方，收起解析列表
            $(document as any).on("click", (e: any) => {
                if (!vipBox.is(e.target) && vipBox.has(e.target).length === 0) {
                    vipBox.removeClass("show");
                }
            });

            let _this = this;
            // 内嵌播放列表项点击事件
            vipBox.find(".vip_list .nq-li").each((liIndex, item) => {
                item.addEventListener("click", () => {
                    const index = parseInt($(item).attr("data-index") as string);
                    GM_setValue(_CONFIG_.autoPlayerVal, index); // 记录选择，用于自动播放
                    GM_setValue(_CONFIG_.flag, "true");
                    _this.showPlayerWindow(_CONFIG_.videoParseList[index]);
                    vipBox.find(".vip_list li").removeClass("selected");
                    $(item).addClass("selected");
                    // 添加点击反馈动画
                    $(item).css('transform', 'scale(0.95)');
                    setTimeout(() => $(item).css('transform', ''), 150);
                });
            });
            // 弹窗播放列表项点击事件
            vipBox.find(".vip_list .tc-li").each((liIndex, item) => {
                item.addEventListener("click", () => {
                    const index = parseInt($(item).attr("data-index") as string);
                    const videoObj = _CONFIG_.videoParseList[index];
                    let url = videoObj.url + window.location.href;
                    GM_openInTab(url, { active: true, insert: true, setParent: true });
                });
            });

            // 悬浮按钮拖拽事件
            vipBox.on('mousedown', function (e) {
                if (e.which !== 1) return; // 只响应左键
                e.preventDefault();
                wasDragged = false;

                const startX = e.pageX;
                const startY = e.pageY;

                let initialOffset: JQuery.Coordinates, windowWidth: number, windowHeight: number, boxWidth: number, boxHeight: number;
                let currentX: number, currentY: number;
                let maxX: number, maxY: number;

                function onMouseMove(e: JQuery.MouseMoveEvent) {
                    if (!wasDragged && (Math.abs(e.pageX - startX) > 5 || Math.abs(e.pageY - startY) > 5)) {
                        wasDragged = true;
                        initialOffset = vipBox.offset() as JQuery.Coordinates;
                        windowWidth = $(window).width() as number;
                        windowHeight = $(window).height() as number;
                        boxWidth = vipBox.outerWidth(true) as number;
                        boxHeight = vipBox.outerHeight(true) as number;
                        currentX = initialOffset.left;
                        currentY = initialOffset.top;
                        maxX = windowWidth - boxWidth;
                        maxY = windowHeight - boxHeight;

                        $('body').css('user-select', 'none');
                        vipBox.css("cursor", "grabbing");
                        vipBox.css("position", "absolute");
                        vipBox.addClass("dragging");
                        vipBox.removeClass("snap-left snap-right show"); // 拖拽时隐藏菜单
                    }

                    if (!wasDragged) return;

                    const newX = Math.max(0, Math.min(maxX, e.pageX - (boxWidth / 2)));
                    const newY = Math.max(0, Math.min(maxY, e.pageY - (boxHeight / 2)));

                    vipBox.css({
                        left: newX + 'px',
                        top: newY + 'px'
                    });

                    currentX = newX;
                    currentY = newY;
                }

                function onMouseUp(e: JQuery.MouseUpEvent) {
                    $(document).off('mousemove', onMouseMove);
                    $(document).off('mouseup', onMouseUp);

                    if (wasDragged) {
                        $('body').css('user-select', '');
                        vipBox.css("cursor", "pointer");
                        vipBox.removeClass("dragging");

                        GM_setValue("vip_button_pos_top", currentY);

                        // 贴边动画
                        vipBox.css({
                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        });

                        setTimeout(() => {
                            vipBox.css("left", "");
                            vipBox.css("position", "fixed");

                            if (currentX + boxWidth / 2 > windowWidth / 2) {
                                GM_setValue("vip_button_side", "right");
                                vipBox.addClass("snap-right");
                            } else {
                                GM_setValue("vip_button_side", "left");
                                vipBox.addClass("snap-left");
                            }

                            // 恢复 transition
                            setTimeout(() => {
                                vipBox.css('transition', '');
                            }, 400);
                        }, 50);
                    }
                }

                $(document).on('mousemove', onMouseMove);
                $(document).on('mouseup', onMouseUp);
            });
            return Promise.resolve(container);
        }

        /**
         * 自动播放钩子：如果用户开启了自动播放，则执行自动解析逻辑。
         * @param container 页面 body 元素
         */
        autoPlay(container: HTMLElement): Promise<HTMLElement> {
            const vipBox = $(`#${_CONFIG_.vipBoxId}`);
            const autoToggle = vipBox.find("#vip_auto_toggle");

            // 自动播放开关事件
            autoToggle.on("click", function () {
                const isOn = $(this).hasClass("on");
                if (isOn) {
                    GM_setValue(_CONFIG_.autoPlayerKey, null);
                    $(this).removeClass("on");
                } else {
                    GM_setValue(_CONFIG_.autoPlayerKey, "true");
                    $(this).addClass("on");
                }
                // 刷新页面以应用更改
                setTimeout(() => window.location.reload(), 200);
            });

            // 如果开启了自动播放，则选择播放源
            if (!!GM_getValue(_CONFIG_.autoPlayerKey, null)) {
                this.selectPlayer(container);
            }
            return Promise.resolve(container);
        }

        /**
         * 根据本地存储的设置，选择并播放视频。
         * @param container 页面 body 元素
         */
        selectPlayer(container: HTMLElement): void {
            let index = GM_getValue(_CONFIG_.autoPlayerVal, 2) as number;
            let autoObj = _CONFIG_.videoParseList[index];
            let _th = this;
            if (autoObj.type.includes("1")) { // 只支持内嵌播放
                setTimeout(function () {
                    _th.showPlayerWindow(autoObj);
                    const vipBox = $(`#${_CONFIG_.vipBoxId}`);
                    vipBox.find(`.vip_list [title="${autoObj.name}1"]`).addClass("selected");
                    $(container).find("#vip_auto").attr("title", `自动解析源：${autoObj.name}`);
                }, 2500);
            }
        }

        /**
         * 显示播放器窗口，将解析后的视频注入页面。
         * @param videoObj 选中的视频解析服务对象
         */
        showPlayerWindow(videoObj: VideoParseItem): void {
            if (!_CONFIG_.currentPlayerNode) return;

            util.findTargetEle(_CONFIG_.currentPlayerNode.container)
                .then((container) => {
                    const type = videoObj.type;
                    let url = videoObj.url + window.location.href;
                    if (type.includes("1")) { // 内嵌播放
                        util.reomveVideo(); // 移除原生视频
                        $(container).empty(); // 清空播放器容器
                        let iframeDivCss = "width:100%;height:100%;z-index:999999;";
                        if (_CONFIG_.isMobile) {
                            iframeDivCss = "width:100%;height:220px;z-index:999999;";
                        }
                        if (_CONFIG_.isMobile && window.location.href.indexOf("iqiyi.com") !== -1) {
                            iframeDivCss = "width:100%;height:220px;z-index:999999;margin-top:-56.25%;";
                        }
                        // 注入 iframe
                        $(container).append(`<div style="${iframeDivCss}"><iframe id="iframe-player-4a5b6c" src="${url}" style="border:none;" allowfullscreen="true" width="100%" height="100%"></iframe></div>`);
                    }
                });
        }

        /**
         * 后处理钩子：处理 SPA 页面跳转等收尾工作。
         * @param container 页面 body 元素
         */
        postHandle(container: HTMLElement): void {
            if (!!GM_getValue(_CONFIG_.autoPlayerKey, null)) {
                util.urlChangeReload(); // 如果开启了自动播放，则监听 URL 变化
            } else {
                let oldHref = window.location.href;
                let interval = setInterval(() => {
                    let newHref = window.location.href;
                    if (oldHref !== newHref) {
                        oldHref = newHref;
                        // 如果是通过点击解析列表触发的跳转，则刷新页面
                        if (!!GM_getValue(_CONFIG_.flag, null)) {
                            clearInterval(interval);
                            window.location.reload();
                        }
                    }
                }, 1000);
            }
        }
    }

    /**
     * 默认的消费者实现，继承自 BaseConsumer。
     * 未来可以为特定网站扩展不同的 Consumer。
     */
    class DefaultConsumer extends BaseConsumer {

    }

    return {
        /**
         * 脚本启动函数。
         */
        start: () => {
            GM_setValue(_CONFIG_.flag, null); // 重置标志
            // 根据当前域名从配置中查找匹配的播放器设置
            let playerNode = _CONFIG_.playerContainers.filter(value => value.host === window.location.host);
            if (playerNode === null || playerNode.length <= 0) {
                console.warn(window.location.host + "该网站暂不支持，请联系作者，作者将会第一时间处理（注意：请记得提供有问题的网址）");
                return;
            }
            _CONFIG_.currentPlayerNode = playerNode[0];
            // 实例化消费者并开始解析流程
            const targetConsumer = new DefaultConsumer();
            targetConsumer.parse();
        }
    }

})();

export default superVip;