import{_ as e}from"./plugin-vue_export-helper-DlAUqK2U.js";import{o as i,c as t,d as a}from"./app-mS0fT-Fr.js";const n={},o=a(`<h1 id="分布式锁理论介绍" tabindex="-1"><a class="header-anchor" href="#分布式锁理论介绍"><span>分布式锁理论介绍</span></a></h1><blockquote><p>闲话漫谈： 本来是想要写一篇关于 Spring 提供的 RedisLockRegistry 的使用方法及底层原理解析的文章，写着写着发现得先介绍一下分布式锁的基本原理，才能有助于理解一些实现内容。最后发现关于分布式锁的基本介绍也占据了较大篇幅，因此另开一篇，介绍一下分布式锁。</p></blockquote><h2 id="_1-什么是分布式锁" tabindex="-1"><a class="header-anchor" href="#_1-什么是分布式锁"><span>1. 什么是分布式锁？</span></a></h2><p>何为分布式锁，为什么需要分布式锁？在解答这个问题之前，需要先介绍本地锁的概念。Java 提供了 synchronized 关键字和 juc 中的 Lock 锁，这两者都是本地锁。本地锁指的是，该锁只针对当前虚拟机有效，也就是当你部署运行了一个 Java 项目 A 并且获取锁时，新起另一个 Java 项目，同样还可以获取锁，这两个锁之间没有任何关系。这便属于本地锁。因此，当你的服务只需要部署一个节点时，那么只需要用到本地锁即可。当你的系统需要支撑高并发、高性能等特性而去部署多节点时，本地锁便不够用了。本地锁无法解决多节点之间的资源竞争问题。因此，便需要用到分布式锁。在分布式锁中，当一个节点获取到锁后，其余节点在该锁被释放前均不可以获取锁。 如何实现分布式锁？分布式锁没有那么玄乎，其实就是将资源竞争条件从单个节点中拎出来，放到一个公共的、各节点均可以访问到的地方，各节点都共同去争抢这个锁。这样，大家就都能看到这个锁的争抢情况，自然可以进行锁的调度管控。</p><h2 id="_2-分布式锁理论的简单图示" tabindex="-1"><a class="header-anchor" href="#_2-分布式锁理论的简单图示"><span>2. 分布式锁理论的简单图示</span></a></h2><p>如下图所示，一开始，三个节点共同去争抢一把锁</p><figure><img src="http://zzk31.320.io//img/20240403095528.png" alt="图1" tabindex="0" loading="lazy"><figcaption>图1</figcaption></figure><p>接着，节点 A 率先抢到了这个锁</p><figure><img src="http://zzk31.320.io/img/20240403095923.png" alt="图2" tabindex="0" loading="lazy"><figcaption>图2</figcaption></figure><p>在节点 A 执行完锁内操作后，释放了这把锁，另外两个节点继续争抢该锁</p><figure><img src="http://zzk31.320.io/img/20240403100024.png" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><h2 id="_3-分布式锁的特征" tabindex="-1"><a class="header-anchor" href="#_3-分布式锁的特征"><span>3. 分布式锁的特征</span></a></h2><p>为了能够稳定可靠的实现上述目的，一个分布式锁需要具备以下特征：</p><ul><li>互斥性: 任意时刻，只有一个客户端能持有锁。</li><li>锁超时释放：持有锁超时，可以释放，防止不必要的资源浪费，也可以防止死锁。</li><li>可重入性:一个线程如果获取了锁之后,可以再次对其请求加锁。</li><li>高性能和高可用：加锁和解锁需要开销尽可能低，同时也要保证高可用，避免分布式锁失效。</li><li>安全性：锁只能被持有的客户端删除，不能被其他客户端删除</li></ul><h2 id="_4-redis-分布式锁实现方式简介" tabindex="-1"><a class="header-anchor" href="#_4-redis-分布式锁实现方式简介"><span>4. Redis 分布式锁实现方式简介</span></a></h2><p>分布式锁的实现可以有多种方式，目前比较熟知的有 Zookeeper、数据库和 Redis 实现。我们这里主要介绍在 Redis 中实现分布式锁。</p><p>先说一下 Redis 中实现分布式锁的基本理论。多个节点去同一个 Redis 服务设置一个相同的 key，谁先设置成功谁就抢到了该锁，未成功设置 key 的节点则等待锁释放（这里有两种方式，一种是节点主动定时去尝试设置该 key，失败了就说明该锁还在使用;另一种方式是利用 Redis 提供的发布订阅功能，节点订阅该 key，当该 key 失效时，redis 主动通知节点）。当然，一个 key 不能永远生效，节点需要为 key 设置过期时间，这段时间就是该节点持有该锁的时间。当该 key 过期，其他线程可以继续争抢该锁。因此，第 3 小节中提到的互斥性和锁超时释放得以基本实现。</p><p>Redis 为我们提供了<code>setnx</code>和<code>expire</code>命令。使用<code>setnx</code>来抢锁，如果抢到之后，再用<code>expire</code>为锁设置过期时间，防止锁忘记了释放。</p><p>然而 setnx 和 expire 是两个命令,并非原子操作。如果执行了<code>setnx</code>命令后，节点崩溃了，还没来得及执行<code>expire</code>命令，那么该锁就永远不会过期了，其他节点就永远无法获得该锁了。</p><blockquote><p>这里的原子操作与我们在数据库事务中用到的原子性并不等同。数据库事务中的原子性指“要么都成功要么都失败”。而我们这里的原子操作，仅是指操作不可被拆分，实际上 Redis 中执行 Lua 脚本即使出错也不会回滚。</p></blockquote><p>为了解决该问题，我们可以使用 Lua 脚本。Lua 脚本允许我们将多个命令打包执行,成为原子操作。</p><p>除了使用 Lua 脚本，保证 <code>setnx</code> + <code>expire</code> 两条指令的原子性，Redis 还为我们提供了 <code>set</code> 指令扩展参数，通过使用扩展参数，我们也可以实现上面的目的。</p><div class="language-Redis line-numbers-mode" data-ext="Redis" data-title="Redis"><pre class="language-Redis"><code>SET key value [EX seconds] [PX milliseconds] [NX|XX]）
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><ul><li>EX seconds :设定 key 的过期时间，时间单位是秒。</li><li>PX milliseconds: 设定 key 的过期时间，单位为毫秒</li><li>NX :表示 key 不存在的时候，才能 set 成功。</li><li>XX: 表示 key 存在的时候，才能 set 成功。</li></ul><p>解决了设置 key 和为 key 设置过期时间两个命令的原子操作问题，我们还无法实现一把靠谱的分布式锁。假设这种场景：节点 a 获取锁成功，开始执行临界区代码。当锁过期了，节点 a 还没执行完临界区代码。此时节点 b 也请求过来，显然节点 b 是可以成功获得该锁的。节点 b 也开始执行临界区代码，那么临界区代码的互斥性串行性就被破坏了。此外，当节点 a 执行完临界区代码，去释放锁，然而此时节点 b 还没执行完临界区代码（节点 a 以为释放的是自己的锁）。这个问题同样很严重。一个节点的锁被另一个节点错误释放了，不满足 第 3 小节中提到<em>安全性</em>。</p><p>总结以下，上面提到的两个问题：</p><ol><li>锁过期释放了，节点的业务还未执行完。</li><li>锁被别的节点误删。</li></ol><p>我们先解决问题 2。为了防止节点上的锁被别的节点误删，我们可以将 value 值设置为一个能够标记当前节点的唯一值。在释放锁时，对 value 进行校验，仅释放属于当前节点上的锁。 伪代码如下：</p><div class="language-C line-numbers-mode" data-ext="C" data-title="C"><pre class="language-C"><code>// 上锁
redisClient.set(key, clientId, &quot;NX&quot;, &quot;EX&quot;, expireTime) // clientId即是标记当前节点的唯一值
// 执行业务方法
doBusness()
// 比较并解锁
if compare(redisClient.get(key), clientId)
  redisClient.del(key)
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>上述比较 value 相等后删除 key 的操作也可以使用 Lua 脚本来实现原子操作</p><p>离设计一个靠谱的分布式锁越来越近了，我们还剩下一个问题没解决： 锁过期释放了，节点的业务还未执行完</p><p>一种简单的方法是将锁的过期时间设置得久一点，这当然也可以。 但是这种处理方式很不灵活，而且不同业务方法的执行时间不同，有的久一点，有的短一点。如果对所有业务方法都应用一个比较久的过期时间，那么系统的响应速度就会变慢，不足以称得上<em>高可用高性能</em></p><p>一个更好的方法是设置一个定时线程，周期性地检查锁，对即将过期的锁延长其过期时间，防止锁过期提前释放。在这方面，Java 的 Redission 便是采用了这种方式，其使用了一个 watch dog 机制来周期检查锁，对锁执行延长过期时间操作。</p><p>到这里，我们的分布式锁已经做到了<em>互斥性</em>、<em>锁超时释放</em>、<em>高性能高可用</em>和<em>安全性</em>，还剩下一个<em>可重入</em>特性还没实现。关于可重入，通常由具体的客户端来实现，比如 Spring 提供的 RedisLockRegistry，则是利用的 JDK 提供的 Lock 来实现可重入。</p><div class="hint-container tip"><p class="hint-container-title">拉个 Star</p><ul><li>看到这里，如果<a href="https://github.com/shzyjbr/person-database" target="blank">本篇文章</a>的内容帮助到你，还请点个免费的 Star，感谢。传送门：<a href="https://github.com/shzyjbr/person-database" target="blank">GitHub</a></li></ul></div>`,35),d=[o];function s(r,l){return i(),t("div",null,d)}const m=e(n,[["render",s],["__file","distributed-lock-introduction.html.vue"]]),u=JSON.parse('{"path":"/java/distributed-lock-introduction.html","title":"分布式锁理论介绍","lang":"zh-CN","frontmatter":{"title":"分布式锁理论介绍","date":"2024-04-04T00:00:00.000Z","tag":["Java"],"description":"分布式锁理论介绍 闲话漫谈： 本来是想要写一篇关于 Spring 提供的 RedisLockRegistry 的使用方法及底层原理解析的文章，写着写着发现得先介绍一下分布式锁的基本原理，才能有助于理解一些实现内容。最后发现关于分布式锁的基本介绍也占据了较大篇幅，因此另开一篇，介绍一下分布式锁。 1. 什么是分布式锁？ 何为分布式锁，为什么需要分布式锁？...","head":[["meta",{"property":"og:url","content":"https://shzyjbr.github.com/person-database/person-database/java/distributed-lock-introduction.html"}],["meta",{"property":"og:site_name","content":"zzk的个人知识库"}],["meta",{"property":"og:title","content":"分布式锁理论介绍"}],["meta",{"property":"og:description","content":"分布式锁理论介绍 闲话漫谈： 本来是想要写一篇关于 Spring 提供的 RedisLockRegistry 的使用方法及底层原理解析的文章，写着写着发现得先介绍一下分布式锁的基本原理，才能有助于理解一些实现内容。最后发现关于分布式锁的基本介绍也占据了较大篇幅，因此另开一篇，介绍一下分布式锁。 1. 什么是分布式锁？ 何为分布式锁，为什么需要分布式锁？..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:image","content":"http://zzk31.320.io//img/20240403095528.png"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2024-04-04T09:17:30.000Z"}],["meta",{"name":"twitter:card","content":"summary_large_image"}],["meta",{"name":"twitter:image:alt","content":"分布式锁理论介绍"}],["meta",{"property":"article:author","content":"zzk"}],["meta",{"property":"article:tag","content":"Java"}],["meta",{"property":"article:published_time","content":"2024-04-04T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2024-04-04T09:17:30.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"分布式锁理论介绍\\",\\"image\\":[\\"http://zzk31.320.io//img/20240403095528.png\\",\\"http://zzk31.320.io/img/20240403095923.png\\",\\"http://zzk31.320.io/img/20240403100024.png\\"],\\"datePublished\\":\\"2024-04-04T00:00:00.000Z\\",\\"dateModified\\":\\"2024-04-04T09:17:30.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"zzk\\",\\"url\\":\\"https://github.com/shzyjbr\\"}]}"]]},"headers":[{"level":2,"title":"1. 什么是分布式锁？","slug":"_1-什么是分布式锁","link":"#_1-什么是分布式锁","children":[]},{"level":2,"title":"2. 分布式锁理论的简单图示","slug":"_2-分布式锁理论的简单图示","link":"#_2-分布式锁理论的简单图示","children":[]},{"level":2,"title":"3. 分布式锁的特征","slug":"_3-分布式锁的特征","link":"#_3-分布式锁的特征","children":[]},{"level":2,"title":"4. Redis 分布式锁实现方式简介","slug":"_4-redis-分布式锁实现方式简介","link":"#_4-redis-分布式锁实现方式简介","children":[]}],"git":{"createdTime":1712222250000,"updatedTime":1712222250000,"contributors":[{"name":"Kelton","email":"417160807@qq.com","commits":1}]},"readingTime":{"minutes":7.29,"words":2188},"filePathRelative":"java/distributed-lock-introduction.md","localizedDate":"2024年4月4日","excerpt":"\\n<blockquote>\\n<p>闲话漫谈： 本来是想要写一篇关于 Spring 提供的 RedisLockRegistry 的使用方法及底层原理解析的文章，写着写着发现得先介绍一下分布式锁的基本原理，才能有助于理解一些实现内容。最后发现关于分布式锁的基本介绍也占据了较大篇幅，因此另开一篇，介绍一下分布式锁。</p>\\n</blockquote>\\n<h2>1. 什么是分布式锁？</h2>\\n<p>何为分布式锁，为什么需要分布式锁？在解答这个问题之前，需要先介绍本地锁的概念。Java 提供了 synchronized 关键字和 juc 中的 Lock 锁，这两者都是本地锁。本地锁指的是，该锁只针对当前虚拟机有效，也就是当你部署运行了一个 Java 项目 A 并且获取锁时，新起另一个 Java 项目，同样还可以获取锁，这两个锁之间没有任何关系。这便属于本地锁。因此，当你的服务只需要部署一个节点时，那么只需要用到本地锁即可。当你的系统需要支撑高并发、高性能等特性而去部署多节点时，本地锁便不够用了。本地锁无法解决多节点之间的资源竞争问题。因此，便需要用到分布式锁。在分布式锁中，当一个节点获取到锁后，其余节点在该锁被释放前均不可以获取锁。\\n如何实现分布式锁？分布式锁没有那么玄乎，其实就是将资源竞争条件从单个节点中拎出来，放到一个公共的、各节点均可以访问到的地方，各节点都共同去争抢这个锁。这样，大家就都能看到这个锁的争抢情况，自然可以进行锁的调度管控。</p>","autoDesc":true}');export{m as comp,u as data};
