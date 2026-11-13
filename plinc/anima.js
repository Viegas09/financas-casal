/* Plinc — animações da página de venda (GSAP + ScrollTrigger, hospedados em vendor/).
 * Sem GSAP, ou para quem pede menos movimento no sistema, a página aparece normal e parada.
 */
(function () {
  "use strict";
  var raiz = document.documentElement;
  var mostrarTudo = function () { raiz.classList.remove("anima"); };
  if (!raiz.classList.contains("anima")) return;
  if (!window.gsap || !window.ScrollTrigger) return mostrarTudo();
  var seguranca = setTimeout(mostrarTudo, 4000);   // se algo travar, nada fica escondido

  try {
    gsap.registerPlugin(ScrollTrigger);
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    // ---------- Abertura: a moeda cai no cofrinho ----------
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(".fenda", { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.6 }, 0)
      .fromTo(".moeda-gigante", { y: -620, autoAlpha: 1 }, { y: 0, autoAlpha: 1, duration: 1.15, ease: "bounce.out" }, 0.15)
      .fromTo("#logo-topo .moeda", { y: -46 }, { y: 0, duration: 0.9, ease: "bounce.out" }, 0.2)
      .fromTo("#logo-topo .som", { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(3)" }, 0.75)
      .fromTo(".hero h1 .linha > span", { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1, ease: "power4.out", stagger: 0.12 }, 0.1)
      .fromTo(".hero [data-entra]", { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08 }, 0.45)
      .fromTo("[data-celular-hero]", { y: 90, rotation: 5, autoAlpha: 0 }, { y: 0, rotation: 0, autoAlpha: 1, duration: 1.1 }, 0.55)
      .fromTo(".notificacao", { y: 24, scale: 0.9, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.7, ease: "back.out(1.8)" }, 1.5)
      .add(function () { clearTimeout(seguranca); });

    // ---------- Notificação troca de mensagem (o que um lança, o outro vê) ----------
    var msgs = [
      "Léo pagou a conta de luz. Faltam 2 contas este mês.",
      "Ana lançou Mercado: R$ 86,40. Ainda dá R$ 31 por dia.",
      "Amanhã vence a internet: R$ 120,00.",
      "Meta Viagem: mais R$ 300 guardados."
    ];
    var i = 0, texto = $("#notif-texto"), notif = $(".notificacao");
    var trocar = function () {
      i = (i + 1) % msgs.length;
      gsap.timeline()
        .to(notif, { y: -10, autoAlpha: 0, duration: 0.3, ease: "power2.in" })
        .add(function () { texto.textContent = msgs[i]; })
        .fromTo(notif, { y: 16, scale: 0.94 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.55, ease: "back.out(1.8)" });
      gsap.delayedCall(3.6, trocar);
    };
    gsap.delayedCall(4.2, trocar);

    // ---------- Faixa azul rolando sem parar ----------
    gsap.to(".faixa .trilho", { xPercent: -50, duration: 32, ease: "none", repeat: -1 });

    // ---------- Celular do topo sobe um pouco ao rolar ----------
    gsap.to(".vitrine", { y: -60, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

    // ---------- Blocos entram ao aparecer na tela ----------
    var entram = $$("[data-entra]").filter(function (el) { return !el.closest(".hero"); });
    gsap.set(entram, { y: 40, autoAlpha: 0 });
    ScrollTrigger.batch(entram, {
      start: "top 90%",
      once: true,
      onEnter: function (lote) { gsap.to(lote, { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.09, overwrite: true }); }
    });

    // ---------- Celulares das seções flutuam ao rolar ----------
    $$("[data-paralaxe]").forEach(function (el) {
      gsap.fromTo(el, { y: 70, rotation: -2 }, { y: -70, rotation: 2, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // ---------- R$ 19,90 conta de 0 até o preço ----------
    var valor = $("#valor-grande");
    if (valor) {
      var n = { v: 0 };
      ScrollTrigger.create({
        trigger: ".numerao", start: "top 75%", once: true,
        onEnter: function () {
          gsap.to(n, { v: 19.9, duration: 1.4, ease: "power2.out", onUpdate: function () { valor.textContent = n.v.toFixed(2).replace(".", ","); } });
        }
      });
    }

    // ---------- Plano de preço: leve zoom ao entrar ----------
    ScrollTrigger.create({
      trigger: ".plano", start: "top 85%", once: true,
      onEnter: function () { gsap.fromTo(".plano .valor", { scale: 0.85 }, { scale: 1, duration: 0.9, ease: "back.out(2)", delay: 0.2 }); }
    });

    // imagens carregando mudam a altura da página: recalcula os pontos de disparo
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  } catch (e) {
    console.warn("animações desligadas", e);
    mostrarTudo();
  }
})();
